// =============================================================================
// PDS 同期・改ざん検証モジュール
//
// このアプリの質問(com.suibari.meyasuat.question)・回答(com.suibari.meyasuat.answer)
// レコードは各ユーザー自身のPDS上に存在する。AppView側DB(messagesテーブル)は
// Firehose/Jetstreamではなく、ページ表示のたびにPDSをポーリングして同期する。
//
// 【改ざん防止の方針：回答レコード自身のquestionRefによる固定】
// AT Protocolの仕様上、リポジトリ所有者は自分のレコードを putRecord で自由に
// 書き換えられるため、PDSレベルで編集を禁止することはできない。守るべきは
// 「回答が付いた後に、送信者が質問を書き換えて回答者を貶める」ケースのみ。
//
// これは回答レコード自身が持つ questionRef（com.atproto.repo.strongRef =
// uri+cid）で防げる。answerレコードは回答時点の質問cidを自分のレコードに
// 刻んでおり、これは箱主(answerレコードの所有者)にしか書き換えられない。
// よって「質問の現在のcid」と「回答が刻んだquestionRef.cid」を比較するだけで、
// 回答後に質問側が書き換えられたかどうかをアプリDB側の台帳を持たずに検証できる。
//
// 未回答の質問はまだ誰にも見せた「回答時点の内容」が存在しないため、
// 送信者が書き換えても実害がない（凍結する理由がない）。よってボディは
// 回答が付くまでは常に最新のPDS内容に追従し、回答が付いた瞬間に凍結される
// （以降は回答レコード自身の question フィールドが正となる想定：Phase 4以降）。
//
// 回答は箱主自身の所有物なので、箱主が自分の回答を後から編集するのは正当な
// 変更であり「改ざん」ではない。よって回答側には凍結・改ざんブロックを設けない。
//
// 【各関数の責務】
//   - ingest系(list走査／ダッシュボード表示時)：唯一の「書き込み」経路。
//     未回答質問の追従・回答の追従・削除復活の自己修復を行う。
//   - reconcileMessageWithPds(メッセージ詳細ページ表示時)：削除検知(404)と
//     回答後の質問改ざん検知(questionRef.cid不一致のログ記録)のみ。
//     本文は一切書き換えない。
// =============================================================================

import { getRecordByAtUri, listRecordsByRepo, parseAtUri } from '$lib/server/atproto.js';
import type { Message } from '$lib/server/db.js';
import {
	createMessageFromPds,
	getMessageById,
	getMessageByQuestionRecordUri,
	getUserByDid,
	markAnswerMissingFromPds,
	pruneAnsweredContent,
	reconcileAnswerFromPds,
	reconcileQuestionFromPds,
	updateMessageAnswerRef,
	updateMessageQuestionRef
} from '$lib/server/db.js';
import { extractImageUrlsFromQuestionRecordValue } from '$lib/server/messageImages.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

type Env = App.Platform['env'];

function logSkippedRecord(reason: string, uri: string, details?: Record<string, unknown>): void {
	console.warn('[pds-sync] skipped record', {
		reason,
		uri,
		...details
	});
}

function asString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function asDid(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return value.startsWith('did:') ? value : null;
}

function parseMessageIdFromUrl(url: string | null, appUrl: string): string | null {
	if (!url) return null;
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return null;
	}

	const base = new URL(appUrl);
	if (parsedUrl.origin !== base.origin) return null;

	const matched = parsedUrl.pathname.match(/^\/u\/[^/]+\/m\/([0-9a-fA-F-]{36})$/);
	if (!matched) return null;
	return matched[1] ?? null;
}

async function ingestQuestionCreatesFromPds(env: Env, senderDid: string, appUrl: string): Promise<boolean> {
	const records = await listRecordsByRepo(senderDid, 'com.suibari.meyasuat.question', 50);
	let changed = false;

	for (const rec of records) {
		const text = asString(rec.value.text);
		const subjectDid = asDid(rec.value.subject);
		const messageId = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
		if (!text || !subjectDid || !messageId) {
			logSkippedRecord('question-missing-required-fields-or-message-id', rec.uri, {
				hasText: !!text,
				hasSubjectDid: !!subjectDid,
				hasMessageId: !!messageId
			});
			continue;
		}

		let message = await getMessageById(env, messageId);
		if (!message) {
			// 箱主(subject)のユーザーが存在しない場合は取り込まない。
			// 箱を削除したユーザー宛の質問レコードが送信者PDSに残っていても、
			// 削除済みの箱を再生成（復活）させないためのガード。
			const boxOwner = await getUserByDid(env, subjectDid);
			if (!boxOwner) {
				logSkippedRecord('question-box-owner-deleted', rec.uri, {
					messageId,
					subjectDid
				});
				continue;
			}
			message = await createMessageFromPds(env, {
				id: messageId,
				creatorDid: subjectDid,
				body: text,
				senderDid,
				questionRecordUri: rec.uri
			});
			if (message) changed = true;
			else {
				logSkippedRecord('question-create-from-pds-failed', rec.uri, { messageId });
				continue;
			}
		}

		if (!message || message.senderDid !== senderDid) {
			logSkippedRecord('question-owner-mismatch', rec.uri, {
				messageId,
				expectedSenderDid: senderDid,
				actualSenderDid: message?.senderDid ?? null
			});
			continue;
		}

		const parsed = parseAtUri(rec.uri);
		if (!parsed || parsed.repo !== senderDid) {
			logSkippedRecord('question-at-uri-repo-mismatch', rec.uri, {
				expectedRepoDid: senderDid,
				actualRepoDid: parsed?.repo ?? null
			});
			continue;
		}

		// uriの紐付け自体は改ざんと無関係（単なるリンク）なので、回答済みかどうかに
		// 関わらず未確定なら確定させる。reconcileMessageWithPds の削除検知・
		// questionRef.cid突合はこのuriを前提にしている。
		if (message.questionRecordUri !== rec.uri) {
			const updated = await updateMessageQuestionRef(env, message.id, senderDid, rec.uri);
			if (updated) changed = true;
		}

		// 回答済みの質問は本文が凍結済み：回答レコード自身の question スナップショットが
		// 正となるため、送信者側の以後の編集はここでは反映しない。
		// （answeredAtで判定する。answerは剪定後に空文字列になり得るためfalsy判定に使えない）
		if (message.answeredAt) {
			continue;
		}

		// 未回答の間は常に最新のPDS内容へ追従する（凍結する理由がまだ無いため）。
		if (message.body !== text || message.senderDeletedAt) {
			await reconcileQuestionFromPds(env, message.id, { body: text });
			changed = true;
		}
	}

	return changed;
}

async function ingestAnswerCreatesFromPds(env: Env, creatorDid: string, appUrl: string): Promise<boolean> {
	const records = await listRecordsByRepo(creatorDid, 'com.suibari.meyasuat.answer', 50);
	let changed = false;

	for (const rec of records) {
		const answerText = asString(rec.value.answer);
		const questionText = asString(rec.value.question);
		const createdAt = asString(rec.value.createdAt);
		const subjectDid = asDid(rec.value.subject);
		const questionRef = rec.value.questionRef as { uri?: unknown } | undefined;
		const questionRefUri = asString(questionRef?.uri);
		const messageIdFromUrl = parseMessageIdFromUrl(asString(rec.value.url), appUrl);

		if (!answerText || !questionText) {
			logSkippedRecord('answer-missing-required-fields', rec.uri, {
				hasAnswer: !!answerText,
				hasQuestion: !!questionText
			});
			continue;
		}

		let message: Message | null = null;
		if (questionRefUri) {
			message = await getMessageByQuestionRecordUri(env, questionRefUri);
		}
		if (!message && messageIdFromUrl) {
			message = await getMessageById(env, messageIdFromUrl);
		}

		if (!message && messageIdFromUrl) {
			message = await createMessageFromPds(env, {
				id: messageIdFromUrl,
				creatorDid,
				body: questionText,
				senderDid: subjectDid,
				questionRecordUri: questionRefUri,
				answer: answerText,
				answeredAt: createdAt,
				answerRecordUri: rec.uri
			});
			if (message) changed = true;
			else {
				logSkippedRecord('answer-create-from-pds-failed', rec.uri, { messageId: messageIdFromUrl });
				continue;
			}
		}

		if (!message || message.creatorDid !== creatorDid) {
			logSkippedRecord('answer-unidentifiable-or-owner-mismatch', rec.uri, {
				messageIdFromUrl,
				questionRefUri,
				expectedCreatorDid: creatorDid,
				actualCreatorDid: message?.creatorDid ?? null
			});
			continue;
		}

		// 回答は箱主自身の所有物。本人による後からの編集は正当な変更として
		// 常に追従する（改ざんブロックは設けない）。
		if (message.answerRecordUri !== rec.uri) {
			const updated = await updateMessageAnswerRef(env, message.id, creatorDid, rec.uri);
			if (updated) changed = true;
		} else if (message.body === '' && message.answer === '') {
			// Phase 5でDBの本文キャッシュを既に剪定済み。PDSが正であり続けるため
			// ここで再キャッシュ（復元）してしまうと剪定が無意味になる。
			continue;
		}
		if (message.answer !== answerText || message.answerDeletedAt) {
			await reconcileAnswerFromPds(env, message.id, {
				answer: answerText,
				answeredAt: createdAt ?? message.answeredAt
			});
			changed = true;
		}
	}

	return changed;
}

export async function ingestCreatesFromPdsForUser(env: Env, userDid: string, appUrl: string): Promise<boolean> {
	const [questionResult, answerResult] = await Promise.allSettled([
		ingestQuestionCreatesFromPds(env, userDid, appUrl),
		ingestAnswerCreatesFromPds(env, userDid, appUrl)
	]);

	const questionChanged = questionResult.status === 'fulfilled' && questionResult.value;
	const answerChanged = answerResult.status === 'fulfilled' && answerResult.value;
	return questionChanged || answerChanged;
}

/**
 * 個別メッセージをPDSと突合する（メッセージ詳細ページ表示時に実行）。
 * 役割は削除検知のみ：回答レコードがPDSで404なら、作成者が回答を削除したとみなし
 * 削除マークを付けて未回答へ差し戻す（再度の回答受付を可能にする）。
 *
 * 質問側の削除・改ざん検知はここでは行わない。回答済みメッセージの表示は
 * resolveAnsweredContent が呼び出しの都度ライブで判定するため、ここで
 * 別途フラグを持続化する必要が無い（取り下げ・改ざんとも「表示しない」で
 * 統一され、DB側に恒久フラグを置かない設計）。
 */
export async function reconcileMessageWithPds(env: Env, message: Message): Promise<boolean> {
	if (!message.answerRecordUri) return false;

	const answer = await getRecordByAtUri(message.answerRecordUri);
	if (answer.notFound) {
		// PDS上で回答レコードが消えている＝作成者が回答を削除した → 削除マークを付ける。
		await markAnswerMissingFromPds(env, message.id);
		return true;
	}

	return false;
}

export async function reconcileMessagesWithPds(env: Env, messages: Message[]): Promise<boolean> {
	const results = await Promise.allSettled(messages.map((m) => reconcileMessageWithPds(env, m)));
	return results.some((r) => r.status === 'fulfilled' && r.value);
}

export type ResolvedAnsweredContent = {
	body: string;
	answer: string;
	imageUrls: string[];
};

/**
 * 回答済み一覧の表示用コンテンツをPDSから解決する（read-through）。
 * DBの body/answer はキャッシュに過ぎない。
 *
 * 【記名質問】スナップショットは使わず、常に送信者の質問レコードをライブ取得する。
 * - 404（取り下げ済み）→ 表示しない
 * - cid不一致（回答後に質問が書き換えられた＝改ざん）→ 表示しない
 * - 一致 → ライブの内容をそのまま表示（回答時点から変わっていないことが保証される）
 * この3値判定に統一したことで、取り下げの持続的なDBフラグ（sender_deleted_at）を
 * 表示判定のためだけに持つ必要が無くなる。取り下げも改ざんも「表示しない」という
 * 同じ結果になるため、区別して記録する意味が無い。
 *
 * 【匿名質問】送信者にrepoが無くライブ確認できないため、回答レコード自身の
 * question フィールド（回答時点のスナップショット）が唯一の情報源となる。
 *
 * PDS上で内容を確認できたら、DB側の本文キャッシュ(body/answer)は不要になるため
 * 剪定する（pruneAnsweredContent、best-effort）。剪定後は body/answer が空文字列に
 * なるが、判定は常に answeredAt を使うため影響しない。
 *
 * 戻り値が null の場合、呼び出し側は一覧からこのメッセージを除外する。
 */
export async function resolveAnsweredContent(env: Env, message: Message): Promise<ResolvedAnsweredContent | null> {
	if (!message.answeredAt) return null;

	if (!message.answerRecordUri) {
		// PDSへの書き込みが過去に失敗したレガシーデータ。DBキャッシュのみが正。
		const imageUrls = message.imageKeys.length > 0 ? message.imageKeys.map((k) => r2KeyToUrl(k)) : [];
		return { body: message.body, answer: message.answer ?? '', imageUrls };
	}

	const answerRecord = await getRecordByAtUri(message.answerRecordUri);
	if (answerRecord.notFound) {
		// 回答自体が削除されている。削除マーク自体は reconcileMessageWithPds の担当。
		return null;
	}
	if (!answerRecord.found || !answerRecord.value) return null;

	const answerText = asString(answerRecord.value.answer) ?? message.answer ?? '';
	let body: string;
	let imageUrls: string[] = [];

	if (message.senderDid && message.questionRecordUri) {
		const question = await getRecordByAtUri(message.questionRecordUri);
		if (question.notFound) {
			// 取り下げ済み。
			return null;
		}
		if (!question.found || !question.value) return null;

		const questionRef = answerRecord.value.questionRef as { cid?: unknown } | undefined;
		const pinnedCid = typeof questionRef?.cid === 'string' ? questionRef.cid : null;
		if (pinnedCid && question.cid && pinnedCid !== question.cid) {
			// 回答後に質問が書き換えられた（改ざん）。
			logSkippedRecord('question-edited-after-answered', message.questionRecordUri, {
				messageId: message.id,
				pinnedCid,
				liveCid: question.cid
			});
			return null;
		}

		body = asString(question.value.text) ?? message.body;
		imageUrls = extractImageUrlsFromQuestionRecordValue(message.questionRecordUri, question.value);
	} else {
		// 匿名質問: repoが無いため回答レコードのスナップショットが唯一の情報源。
		body = asString(answerRecord.value.question) ?? message.body;
		if (message.imageKeys.length > 0) {
			imageUrls = message.imageKeys.map((k) => r2KeyToUrl(k));
		}
	}

	// PDSでの存在を確認できたので、DBの本文キャッシュは不要。まだ剪定済みで
	// なければ剪定する（失敗しても表示自体には影響しないbest-effort）。
	if (message.body !== '' || message.answer !== '') {
		await pruneAnsweredContent(env, message.id).catch(() => {});
	}

	return { body, answer: answerText, imageUrls };
}
