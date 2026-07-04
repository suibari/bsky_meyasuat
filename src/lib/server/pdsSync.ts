// =============================================================================
// PDS 読み取り・改ざん検証モジュール
//
// このアプリの質問(com.suibari.meyasuat.question)・回答(com.suibari.meyasuat.answer)
// レコードは各ユーザー自身のPDS上に存在する。回答済み・記名質問の本文はPDSを
// 直接読み、AppView側DB(messagesテーブル)へバックグラウンド同期しない。
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
// 未回答の記名質問は、表示時に送信者PDSのライブ内容を読む。回答後の匿名質問は
// 回答レコード自身の question/images フィールドが正となる。
//
// 回答は箱主自身の所有物なので、箱主が自分の回答を後から編集するのは正当な
// 変更であり「改ざん」ではない。よって回答側には凍結・改ざんブロックを設けない。
//
// このモジュールはPDSを読み取るだけで、DBへメッセージ本文を取り込まない。
// =============================================================================

import {
	getRecordByAtUri,
	listRecordsByRepo,
	parseAtUri,
	type PdsListedRecord,
	type PdsRecordLookupResult
} from '$lib/server/atproto.js';
import type { Message } from '$lib/server/db.js';
import { getMessages, getMessageById } from '$lib/server/db.js';
import { extractImageUrlsFromQuestionRecordValue, extractImageUrlsFromRecordValue } from '$lib/server/messageImages.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

type Env = App.Platform['env'];

export type RecordCache = Map<string, Promise<PdsRecordLookupResult>>;

export function createRecordCache(): RecordCache {
	return new Map();
}

function getRecordCached(uri: string, cache?: RecordCache): Promise<PdsRecordLookupResult> {
	if (!cache) return getRecordByAtUri(uri);
	let pending = cache.get(uri);
	if (!pending) {
		pending = getRecordByAtUri(uri);
		cache.set(uri, pending);
	}
	return pending;
}

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

/**
 * 未回答インボックス・送信済み一覧の質問表示可否をPDSのライブ状態から判定する。
 *
 * 匿名質問は送信者repoが存在しないためDB行が正。記名質問でも古い行で
 * question_record_uri が無い場合は、確認対象が無いので従来通り表示する。
 * question_record_uri がある記名質問だけPDSへ問い合わせ、404なら取り下げ済みとして
 * 表示しない。取得失敗は保守的に非表示にする。
 */
export async function isQuestionVisibleFromPds(message: Message, cache?: RecordCache): Promise<boolean> {
	if (!message.senderDid || !message.questionRecordUri) return true;

	try {
		const question = await getRecordCached(message.questionRecordUri, cache);
		return question.found;
	} catch (e) {
		logSkippedRecord('question-live-check-failed', message.questionRecordUri, {
			messageId: message.id,
			error: e instanceof Error ? e.message : String(e)
		});
		return false;
	}
}

export async function filterMessagesByLiveQuestion(messages: Message[], cache?: RecordCache): Promise<Message[]> {
	const visible = await Promise.all(messages.map((m) => isQuestionVisibleFromPds(m, cache)));
	return messages.filter((_, i) => visible[i]);
}

export async function countVisibleUnread(env: Env, creatorDid: string, cache?: RecordCache): Promise<number> {
	const unread = await getMessages(env, creatorDid, { unreadOnly: true, limit: 1000 });
	const visible = await filterMessagesByLiveQuestion(unread, cache);
	return visible.length;
}

function messageFromAnswerRecord(rec: PdsListedRecord, stored: Message | null, appUrl: string): Message | null {
	const parsed = parseAtUri(rec.uri);
	if (!parsed) return null;
	const answerText = asString(rec.value.answer);
	const questionText = asString(rec.value.question);
	const createdAt = asString(rec.value.createdAt);
	const messageId = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
	if (!answerText || !questionText || !createdAt || !messageId) return null;

	const questionRef = rec.value.questionRef as { uri?: unknown } | undefined;
	const questionRefUri = asString(questionRef?.uri);
	const questionRepo = questionRefUri ? parseAtUri(questionRefUri)?.repo ?? null : null;
	const subjectDid = asDid(rec.value.subject);

	return {
		id: messageId,
		creatorDid: parsed.repo,
		body: questionText,
		imageKeys: stored?.imageKeys ?? [],
		isRead: stored?.isRead ?? true,
		createdAt: stored?.createdAt ?? createdAt,
		answer: answerText,
		answeredAt: createdAt,
		senderDid: questionRepo ?? subjectDid,
		questionRecordUri: questionRefUri,
		answerRecordUri: rec.uri
	};
}

export async function getAnsweredMessagesFromPds(
	env: Env,
	creatorDid: string,
	appUrl: string,
	opts: { limit?: number; offset?: number; excludeId?: string } = {}
): Promise<Message[]> {
	const { limit = 10, offset = 0, excludeId } = opts;
	const fetchLimit = Math.min(100, Math.max(limit + offset + 20, limit));
	const records = await listRecordsByRepo(creatorDid, 'com.suibari.meyasuat.answer', fetchLimit);
	const sorted = records.sort((a, b) => {
		const at = asString(a.value.createdAt) ?? '';
		const bt = asString(b.value.createdAt) ?? '';
		return bt.localeCompare(at);
	});
	const out: Message[] = [];
	const messages = await Promise.all(sorted.map(async (rec) => {
		const messageId = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
		if (!messageId || messageId === excludeId) return null;
		const stored = await getMessageById(env, messageId);
		return messageFromAnswerRecord(rec, stored, appUrl);
	}));
	for (const message of messages) {
		if (message) out.push(message);
	}
	return out.slice(offset, offset + limit);
}

export async function getAnsweredMessageFromPdsById(
	env: Env,
	creatorDid: string,
	appUrl: string,
	messageId: string
): Promise<Message | null> {
	const records = await listRecordsByRepo(creatorDid, 'com.suibari.meyasuat.answer', 1000);
	for (const rec of records) {
		const id = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
		if (id !== messageId) continue;
		const stored = await getMessageById(env, messageId);
		return messageFromAnswerRecord(rec, stored, appUrl);
	}
	return null;
}

export async function getSentMessagesFromPds(
	env: Env,
	senderDid: string,
	appUrl: string,
	opts: { limit?: number; offset?: number } = {}
): Promise<Message[]> {
	const { limit = 20, offset = 0 } = opts;
	const fetchLimit = Math.min(100, Math.max(limit + offset + 20, limit));
	const records = await listRecordsByRepo(senderDid, 'com.suibari.meyasuat.question', fetchLimit);
	const sorted = records.sort((a, b) => {
		const at = asString(a.value.createdAt) ?? '';
		const bt = asString(b.value.createdAt) ?? '';
		return bt.localeCompare(at);
	});
	const out: Message[] = [];
	const messages = await Promise.all(sorted.map(async (rec) => {
		const text = asString(rec.value.text);
		const subjectDid = asDid(rec.value.subject);
		const createdAt = asString(rec.value.createdAt);
		const messageId = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
		if (!text || !subjectDid || !createdAt || !messageId) return null;
		const stored = await getMessageById(env, messageId);
		return {
			id: messageId,
			creatorDid: subjectDid,
			body: text,
			imageKeys: stored?.imageKeys ?? [],
			isRead: stored?.isRead ?? false,
			createdAt,
			answer: null,
			answeredAt: null,
			senderDid,
			questionRecordUri: rec.uri,
			answerRecordUri: stored?.answerRecordUri ?? null
		};
	}));
	for (const message of messages) {
		if (message) out.push(message);
	}
	return out.slice(offset, offset + limit);
}

export type ResolvedQuestionContent = {
	body: string;
	imageUrls: string[];
	senderDid: string | null;
};

export async function resolveQuestionContent(message: Message, cache?: RecordCache): Promise<ResolvedQuestionContent | null> {
	if (!message.questionRecordUri) {
		const imageUrls = message.imageKeys.length > 0 ? message.imageKeys.map((k) => r2KeyToUrl(k)) : [];
		return { body: message.body, imageUrls, senderDid: null };
	}

	try {
		const question = await getRecordCached(message.questionRecordUri, cache);
		if (!question.found || !question.value) return null;
		const body = asString(question.value.text) ?? message.body;
		const imageUrls = extractImageUrlsFromQuestionRecordValue(message.questionRecordUri, question.value);
		return {
			body,
			imageUrls,
			senderDid: parseAtUri(message.questionRecordUri)?.repo ?? null
		};
	} catch (e) {
		logSkippedRecord('question-content-resolve-failed', message.questionRecordUri, {
			messageId: message.id,
			error: e instanceof Error ? e.message : String(e)
		});
		return null;
	}
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
 * この3値判定に統一したことで、取り下げの持続的なDBフラグは不要になる。
 * 取り下げも改ざんも「表示しない」という同じ結果になるため、区別して記録する意味が無い。
 *
 * 【匿名質問】送信者にrepoが無くライブ確認できないため、回答レコード自身の
 * question フィールド（回答時点のスナップショット）が唯一の情報源となる。
 *
 * 戻り値が null の場合、呼び出し側は一覧からこのメッセージを除外する。
 */
export async function resolveAnsweredContent(
	_env: Env,
	message: Message,
	cache?: RecordCache
): Promise<ResolvedAnsweredContent | null> {
	if (!message.answerRecordUri) return null;

	const answerRecord = await getRecordCached(message.answerRecordUri, cache);
	if (answerRecord.notFound) {
		return null;
	}
	if (!answerRecord.found || !answerRecord.value) return null;

	const answerText = asString(answerRecord.value.answer) ?? message.answer ?? '';
	let body: string;
	let imageUrls: string[] = [];

	if (message.senderDid && message.questionRecordUri) {
		const question = await getRecordCached(message.questionRecordUri, cache);
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
		const answerRepo = parseAtUri(message.answerRecordUri)?.repo ?? message.creatorDid;
		imageUrls = extractImageUrlsFromRecordValue(answerRepo, answerRecord.value);
		if (imageUrls.length === 0 && message.imageKeys.length > 0) {
			imageUrls = message.imageKeys.map((k) => r2KeyToUrl(k));
		}
	}

	return { body, answer: answerText, imageUrls };
}
