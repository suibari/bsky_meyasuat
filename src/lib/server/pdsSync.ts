// =============================================================================
// PDS 同期・改ざん検証モジュール
//
// このアプリの質問(com.suibari.meyasuat.question)・回答(com.suibari.meyasuat.answer)
// レコードは各ユーザー自身のPDS上に存在する。AppView側DB(messagesテーブル)は
// Firehose/Jetstreamではなく、ページ表示のたびにPDSをポーリングして同期する。
//
// 【改ざん防止の方針：初回取得時cidフリーズ方式】
// AT Protocolの仕様上、リポジトリ所有者は自分のレコードを putRecord で自由に
// 書き換えられるため、PDSレベルで編集を禁止することはできない。そこでAppView側で
// 「レコードを初めて取得したときのcidを固定し、以後そのcidと異なる内容が来たら
// 改ざんとみなして無視する」ことで、回答済み質問文などの事後編集を防ぐ。
//
// cidはレコード内容(DAG-CBOR)の暗号学的ハッシュなので、
//   保存cid === PDS側cid  ⟺  内容がバイト単位で同一
// が成り立つ。つまり改ざん検出はcidの突合のみで十分で、本文の文字列比較は不要。
//
// 【各関数の責務】
//   - ingest系(list走査／ダッシュボード表示時)：唯一の「書き込み」経路。
//     初回取得・cid確定・削除復活の自己修復・改ざんブロックを行う。
//   - reconcileMessageWithPds(メッセージ詳細ページ表示時)：削除検知(404)と
//     改ざん検知(cid不一致のログ記録)のみ。本文は一切書き換えない。
// =============================================================================

import { getRecordByAtUri, listRecordsByRepo, parseAtUri } from '$lib/server/atproto.js';
import type { Message } from '$lib/server/db.js';
import {
	createMessageFromPds,
	getMessageById,
	getMessageByQuestionRecordUri,
	markAnswerMissingFromPds,
	markQuestionMissingFromPds,
	reconcileAnswerFromPds,
	reconcileQuestionFromPds,
	updateMessageAnswerRef,
	updateMessageQuestionRef
} from '$lib/server/db.js';

type Env = App.Platform['env'];

function logSkippedRecord(reason: string, uri: string, details?: Record<string, unknown>): void {
	console.warn('[pds-sync] skipped record', {
		reason,
		uri,
		...details
	});
}

/**
 * 改ざん（事後編集）を検出する。
 * capturedCid: AppView側DBに既に確定・保存済みのcid
 * incomingCid: 今回PDSから取得したレコードのcid
 *
 * 既にcidを確定済み(capturedCidが非null)で、かつPDS側cidがそれと異なる場合のみtrue
 * ＝ 一度取得したレコードが後から書き換えられた、とみなす。
 * capturedCidがnull(＝未取得・初回、または削除でリセット済み)の場合はfalseを返し、
 * 通常の初回取り込み・削除後の再取り込みは従来どおり許可する。
 */
function isTamperedCidMismatch(capturedCid: string | null, incomingCid: string | null | undefined): boolean {
	return !!capturedCid && !!incomingCid && incomingCid !== capturedCid;
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
			message = await createMessageFromPds(env, {
				id: messageId,
				creatorDid: subjectDid,
				body: text,
				senderDid,
				questionRecordUri: rec.uri,
				questionRecordCid: rec.cid
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

		// 改ざん検知：確定済みcidと異なるcidのレコードが来たら、本文もuri/cidも
		// 一切上書きせずログだけ残してスキップする（事後編集を反映させない）。
		if (isTamperedCidMismatch(message.questionRecordCid, rec.cid)) {
			logSkippedRecord('question-cid-mismatch-tamper-blocked', rec.uri, {
				messageId: message.id,
				capturedCid: message.questionRecordCid,
				incomingCid: rec.cid
			});
			continue;
		}

		// uri/cidの初回確定・バックフィル（未確定のレコードにここで指紋を刻む）。
		if (message.questionRecordUri !== rec.uri || message.questionRecordCid !== rec.cid) {
			const updated = await updateMessageQuestionRef(env, message.id, senderDid, rec.uri, rec.cid);
			if (updated) changed = true;
		}

		// 本文は初回取得時に確定（フリーズ）させる。cidが一致していれば内容は
		// バイト単位で同一なので本文の文字列比較は不要。ここで書き込むのは自己修復
		// （削除扱いにしたレコードがPDS上に復活したケース）だけ。
		if (message.senderDeletedAt) {
			await reconcileQuestionFromPds(env, message.id, { body: text, cid: rec.cid });
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
				answerRecordUri: rec.uri,
				answerRecordCid: rec.cid
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

		// 改ざん検知（回答レコード）：確定済みcidと不一致ならログのみ残してスキップ。
		if (isTamperedCidMismatch(message.answerRecordCid, rec.cid)) {
			logSkippedRecord('answer-cid-mismatch-tamper-blocked', rec.uri, {
				messageId: message.id,
				capturedCid: message.answerRecordCid,
				incomingCid: rec.cid
			});
			continue;
		}

		// uri/cidの初回確定・バックフィル。
		if (message.answerRecordUri !== rec.uri || message.answerRecordCid !== rec.cid) {
			const updated = await updateMessageAnswerRef(env, message.id, creatorDid, rec.uri, rec.cid);
			if (updated) changed = true;
		}

		// 質問と同様、回答本文も初回取得でフリーズ。cid一致＝内容同一なので本文比較は不要。
		// 書き込むのは自己修復（削除扱いの回答レコードが復活したケース）のみ。
		if (message.answerDeletedAt) {
			await reconcileAnswerFromPds(env, message.id, {
				answer: answerText,
				answeredAt: createdAt ?? message.answeredAt,
				cid: rec.cid
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
 * ここでの役割は2つだけ：
 *   1. 削除検知：PDSで404なら、作成者/送信者がレコードを削除したとみなし削除マークを付ける
 *      （作成・削除は正当な操作として追従する）。
 *   2. 改ざん検知：レコードは在るがcidが確定済みの値と食い違う場合、事後編集とみなしログのみ。
 * 本文(body/answer)は初回取得でフリーズ済みのため、この関数では一切書き換えない。
 */
export async function reconcileMessageWithPds(env: Env, message: Message): Promise<boolean> {
	let changed = false;

	if (message.questionRecordUri) {
		const question = await getRecordByAtUri(message.questionRecordUri);
		if (question.notFound) {
			// PDS上でレコードが消えている＝送信者が質問を削除した → 削除マークを付ける。
			await markQuestionMissingFromPds(env, message.id);
			changed = true;
		} else if (question.found && question.value) {
			// レコードが存在する場合は「改ざん（cid不一致）」の検知だけ行う。
			// 本文はフリーズ済みで上書きしない。cidが一致していれば内容も同一なので何もしない。
			if (isTamperedCidMismatch(message.questionRecordCid, question.cid ?? null)) {
				logSkippedRecord('question-cid-mismatch-tamper-blocked', message.questionRecordUri, {
					messageId: message.id,
					capturedCid: message.questionRecordCid,
					incomingCid: question.cid ?? null
				});
			}
		}
	}

	if (message.answerRecordUri) {
		const answer = await getRecordByAtUri(message.answerRecordUri);
		if (answer.notFound) {
			// PDS上で回答レコードが消えている＝作成者が回答を削除した → 削除マークを付ける。
			await markAnswerMissingFromPds(env, message.id);
			changed = true;
		} else if (answer.found && answer.value) {
			// 質問と同様、存在する回答レコードは改ざん検知のみ。本文は上書きしない。
			if (isTamperedCidMismatch(message.answerRecordCid, answer.cid ?? null)) {
				logSkippedRecord('answer-cid-mismatch-tamper-blocked', message.answerRecordUri, {
					messageId: message.id,
					capturedCid: message.answerRecordCid,
					incomingCid: answer.cid ?? null
				});
			}
		}
	}

	return changed;
}

export async function reconcileMessagesWithPds(env: Env, messages: Message[]): Promise<boolean> {
	const results = await Promise.allSettled(messages.map((m) => reconcileMessageWithPds(env, m)));
	return results.some((r) => r.status === 'fulfilled' && r.value);
}
