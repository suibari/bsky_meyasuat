// =============================================================================
// pdsSync のテスト用インメモリ偽実装（偽DB / 偽PDS）
//
// vi.mock で $lib/server/db.js と $lib/server/atproto.js をこのモジュールの
// 実装に差し替え、PDS read-through と改ざん検知を本文レベルで検証する。
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
		createdAt: partial.createdAt ?? new Date().toISOString(),
		answer: partial.answer ?? null,
		answeredAt: partial.answeredAt ?? null,
		senderDid: partial.senderDid ?? null,
		questionRecordUri: partial.questionRecordUri ?? null,
		answerRecordUri: partial.answerRecordUri ?? null
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
	async getUserByDid(_env: Env, did: string): Promise<{ did: string } | null> {
		return { did };
	},

	async getMessageById(_env: Env, id: string): Promise<Message | null> {
		const m = messages.get(id);
		return m ? { ...m } : null;
	},

	async getMessages(
		_env: Env,
		creatorDid: string,
		opts: { limit?: number; offset?: number; unreadOnly?: boolean; readOnly?: boolean } = {}
	): Promise<Message[]> {
		const { limit = 20, offset = 0, unreadOnly = false, readOnly = false } = opts;
		const rows = [...messages.values()]
			.filter((m) => m.creatorDid === creatorDid)
			.filter((m) => !unreadOnly || (!m.isRead && m.answer === null))
			.filter((m) => !readOnly || (m.isRead && m.answer === null))
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.slice(offset, offset + limit);
		return rows.map((m) => ({ ...m }));
	},

	async createMessage(
		_env: Env,
		data: { creatorDid: string; body: string; imageKeys: string[] }
	): Promise<Message> {
		return seedMessage({
			id: crypto.randomUUID(),
			creatorDid: data.creatorDid,
			body: data.body,
			imageKeys: data.imageKeys
		});
	},

	async updateMessageQuestionRef(
		_env: Env,
		id: string,
		uri: string
	): Promise<boolean> {
		const m = messages.get(id);
		if (!m) return false;
		m.questionRecordUri = uri;
		m.senderDid = parseAtUri(uri)?.repo ?? null;
		m.body = '';
		return true;
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
