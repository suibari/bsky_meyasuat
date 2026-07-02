// =============================================================================
// pdsSync のテスト用インメモリ偽実装（偽DB / 偽PDS）
//
// vi.mock で $lib/server/db.js と $lib/server/atproto.js をこのモジュールの
// 実装に差し替え、状態を持たせることで「初回cid確定 → 改ざん →
// 本文・cidが凍結されたまま」という実際の状態遷移を本文レベルで検証する。
//
// 偽実装の挙動は本物の db.ts / atproto.ts に準拠させている（PostgREST/XRPC への
// fetch を、同じ入出力契約を満たすメモリ操作へ置き換えたもの）。
// =============================================================================

import type { Message } from '$lib/server/db.js';
import type { PdsRecordLookupResult, PdsListedRecord } from '$lib/server/atproto.js';

// ---- 状態ストア ------------------------------------------------------------
const messages = new Map<string, Message>();

type StoredRecord = { uri: string; cid: string; value: Record<string, unknown> };
const pdsRecords = new Map<string, StoredRecord>(); // key = at-uri

let cidSerial = 0;

/** 各テストの beforeEach でストアを初期化する。 */
export function resetStores(): void {
	messages.clear();
	pdsRecords.clear();
	cidSerial = 0;
}

/** 決定的なダミーcid（実CID計算は不要。凍結判定はcid突合のみのため）。 */
export function nextCid(prefix = 'bafy'): string {
	cidSerial += 1;
	return `${prefix}-${cidSerial}`;
}

// ---- テストから偽DBを直接覗く/仕込む -------------------------------------
/** 偽DBの現在の message をコピーで返す（テストの assert 用）。 */
export function getStoredMessage(id: string): Message | undefined {
	const m = messages.get(id);
	return m ? { ...m } : undefined;
}

/** message を偽DBへ直接投入する（テストの初期状態づくり用）。 */
export function seedMessage(
	partial: Partial<Message> & Pick<Message, 'id' | 'creatorDid' | 'body'>
): Message {
	const full: Message = {
		id: partial.id,
		creatorDid: partial.creatorDid,
		body: partial.body,
		imageKeys: partial.imageKeys ?? [],
		isRead: partial.isRead ?? false,
		botPostUri: partial.botPostUri ?? null,
		ipHash: partial.ipHash ?? 'seed',
		createdAt: partial.createdAt ?? new Date().toISOString(),
		answer: partial.answer ?? null,
		answeredAt: partial.answeredAt ?? null,
		senderDid: partial.senderDid ?? null,
		questionRecordUri: partial.questionRecordUri ?? null,
		questionRecordCid: partial.questionRecordCid ?? null,
		answerRecordUri: partial.answerRecordUri ?? null,
		answerRecordCid: partial.answerRecordCid ?? null,
		senderDeletedAt: partial.senderDeletedAt ?? null,
		answerDeletedAt: partial.answerDeletedAt ?? null
	};
	messages.set(full.id, full);
	return { ...full };
}

// ---- テストから偽PDSを仕込む/改ざんする ----------------------------------
/** PDSレコードを偽PDSへ投入する。 */
export function seedPdsRecord(rec: StoredRecord): StoredRecord {
	pdsRecords.set(rec.uri, { uri: rec.uri, cid: rec.cid, value: { ...rec.value } });
	return rec;
}

/**
 * 既存レコードを改ざんする（所有者による putRecord 相当）。
 * cid を変えれば内容がバイト単位で変わったのと等価。
 */
export function tamperRecord(
	uri: string,
	patch: { value?: Record<string, unknown>; cid?: string }
): void {
	const rec = pdsRecords.get(uri);
	if (!rec) throw new Error(`tamperRecord: record not found: ${uri}`);
	if (patch.value) rec.value = { ...rec.value, ...patch.value };
	if (patch.cid) rec.cid = patch.cid;
}

/** レコードを削除する（PDS 404 相当）。 */
export function removeRecord(uri: string): void {
	pdsRecords.delete(uri);
}

// ---- 純関数（本物の parseAtUri と同一ロジック）---------------------------
type ParsedAtUri = { repo: string; collection: string; rkey: string };
export function parseAtUri(uri: string): ParsedAtUri | null {
	if (!uri.startsWith('at://')) return null;
	const parts = uri.slice('at://'.length).split('/');
	if (parts.length < 3) return null;
	const [repo, collection, rkey] = parts;
	if (!repo || !collection || !rkey) return null;
	return { repo, collection, rkey };
}

// ---- 偽DB（db.ts が pdsSync に提供する関数のサブセット）------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Env = any;

export const fakeDb = {
	async getMessageById(_env: Env, id: string): Promise<Message | null> {
		const m = messages.get(id);
		return m ? { ...m } : null;
	},

	async getMessageByQuestionRecordUri(_env: Env, uri: string): Promise<Message | null> {
		for (const m of messages.values()) {
			if (m.questionRecordUri === uri) return { ...m };
		}
		return null;
	},

	async createMessage(
		_env: Env,
		data: { creatorDid: string; body: string; imageKeys: string[]; ipHash: string; senderDid: string | null }
	): Promise<Message> {
		return seedMessage({
			id: crypto.randomUUID(),
			creatorDid: data.creatorDid,
			body: data.body,
			imageKeys: data.imageKeys,
			ipHash: data.ipHash,
			senderDid: data.senderDid
		});
	},

	async createMessageFromPds(
		_env: Env,
		data: {
			id?: string;
			creatorDid: string;
			body: string;
			senderDid: string | null;
			questionRecordUri?: string | null;
			questionRecordCid?: string | null;
			answer?: string | null;
			answeredAt?: string | null;
			answerRecordUri?: string | null;
			answerRecordCid?: string | null;
		}
	): Promise<Message | null> {
		const id = data.id ?? crypto.randomUUID();
		// Prefer: resolution=ignore-duplicates 相当。既存idなら挿入されず null。
		if (messages.has(id)) return null;
		return seedMessage({
			id,
			creatorDid: data.creatorDid,
			body: data.body,
			ipHash: 'pds-sync',
			senderDid: data.senderDid,
			questionRecordUri: data.questionRecordUri ?? null,
			questionRecordCid: data.questionRecordCid ?? null,
			answer: data.answer ?? null,
			answeredAt: data.answeredAt ?? null,
			answerRecordUri: data.answerRecordUri ?? null,
			answerRecordCid: data.answerRecordCid ?? null
		});
	},

	async updateMessageQuestionRef(
		_env: Env,
		id: string,
		senderDid: string,
		uri: string,
		cid: string
	): Promise<boolean> {
		const m = messages.get(id);
		if (!m || m.senderDid !== senderDid) return false; // WHERE id AND sender_did
		m.questionRecordUri = uri;
		m.questionRecordCid = cid;
		return true;
	},

	async updateMessageAnswerRef(
		_env: Env,
		id: string,
		creatorDid: string,
		uri: string,
		cid: string
	): Promise<boolean> {
		const m = messages.get(id);
		if (!m || m.creatorDid !== creatorDid) return false; // WHERE id AND creator_did
		m.answerRecordUri = uri;
		m.answerRecordCid = cid;
		return true;
	},

	async reconcileQuestionFromPds(
		_env: Env,
		id: string,
		data: { body: string; cid?: string | null }
	): Promise<void> {
		const m = messages.get(id);
		if (!m) return;
		m.body = data.body;
		m.questionRecordCid = data.cid ?? null;
		m.senderDeletedAt = null;
	},

	async reconcileAnswerFromPds(
		_env: Env,
		id: string,
		data: { answer: string; answeredAt?: string | null; cid?: string | null }
	): Promise<void> {
		const m = messages.get(id);
		if (!m) return;
		m.answer = data.answer;
		m.answeredAt = data.answeredAt ?? new Date().toISOString();
		m.answerRecordCid = data.cid ?? null;
		m.answerDeletedAt = null;
	},

	async markQuestionMissingFromPds(_env: Env, id: string): Promise<void> {
		const m = messages.get(id);
		if (!m) return;
		m.questionRecordUri = null;
		m.questionRecordCid = null;
		m.senderDeletedAt = new Date().toISOString();
	},

	async markAnswerMissingFromPds(_env: Env, id: string): Promise<void> {
		const m = messages.get(id);
		if (!m) return;
		m.answer = null;
		m.answeredAt = null;
		m.answerRecordUri = null;
		m.answerRecordCid = null;
		m.answerDeletedAt = new Date().toISOString();
	}
};

// ---- 偽PDS（atproto.ts が pdsSync に提供する関数のサブセット）------------
export const fakeAtproto = {
	parseAtUri,

	async getRecordByAtUri(uri: string): Promise<PdsRecordLookupResult> {
		const parsed = parseAtUri(uri);
		if (!parsed) return { found: false, notFound: true };
		const rec = pdsRecords.get(uri);
		if (!rec) return { found: false, notFound: true }; // 404 相当
		return { found: true, notFound: false, cid: rec.cid, value: rec.value };
	},

	async listRecordsByRepo(
		repoDid: string,
		collection: string,
		limit = 50
	): Promise<PdsListedRecord[]> {
		const out: PdsListedRecord[] = [];
		for (const rec of pdsRecords.values()) {
			const p = parseAtUri(rec.uri);
			if (p && p.repo === repoDid && p.collection === collection) {
				out.push({ uri: rec.uri, cid: rec.cid, value: rec.value });
			}
		}
		return out.slice(0, limit);
	}
};
