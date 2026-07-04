// =============================================================================
// PDS read-through / 改ざん検知のテスト
//
// db.ts / atproto.ts をインメモリ偽実装（helpers/pdsSyncStores.ts）に差し替え、
// pdsSync.ts がDBへ同期せず、表示時にPDSを正として読むことを検証する。
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db.js', async () => (await import('./helpers/pdsSyncStores')).fakeDb);
vi.mock('$lib/server/atproto.js', async () => (await import('./helpers/pdsSyncStores')).fakeAtproto);

import {
	countVisibleUnread,
	filterMessagesByLiveQuestion,
	getAnsweredMessageFromPdsById,
	getAnsweredMessagesFromPds,
	getSentMessagesFromPds,
	isQuestionVisibleFromPds,
	resolveAnsweredContent,
	resolveQuestionContent
} from '$lib/server/pdsSync.js';
import {
	getStoredMessage,
	nextCid,
	removeRecord,
	resetStores,
	seedMessage,
	seedPdsRecord,
	tamperRecord
} from './helpers/pdsSyncStores.js';

const APP_URL = 'http://localhost:5173';
const CREATOR = 'did:plc:creator';
const SENDER = 'did:plc:sender';
const HANDLE = 'alice';
const QUESTION_COLLECTION = 'com.suibari.meyasuat.question';
const ANSWER_COLLECTION = 'com.suibari.meyasuat.answer';

const env = {} as Parameters<typeof countVisibleUnread>[0];

function newMessageId(): string {
	return crypto.randomUUID();
}

function urlFor(id: string): string {
	return `${APP_URL}/u/${HANDLE}/m/${id}`;
}

function questionUri(rkey = 'q1'): string {
	return `at://${SENDER}/${QUESTION_COLLECTION}/${rkey}`;
}

function answerUri(rkey = 'a1'): string {
	return `at://${CREATOR}/${ANSWER_COLLECTION}/${rkey}`;
}

let currentId: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

function seedQuestionRecord(text: string, cid: string, rkey = 'q1', id = currentId): void {
	seedPdsRecord({
		uri: questionUri(rkey),
		cid,
		value: { text, subject: CREATOR, url: urlFor(id), createdAt: new Date().toISOString() }
	});
}

function seedAnswerRecord(
	answer: string,
	question: string,
	cid: string,
	opts: { named: boolean; questionRefCid?: string; images?: unknown[]; rkey?: string; id?: string; createdAt?: string }
): void {
	const id = opts.id ?? currentId;
	seedPdsRecord({
		uri: answerUri(opts.rkey ?? 'a1'),
		cid,
		value: {
			answer,
			question,
			subject: opts.named ? SENDER : null,
			questionRef: opts.named
				? { uri: questionUri(), ...(opts.questionRefCid ? { cid: opts.questionRefCid } : {}) }
				: undefined,
			images: opts.images,
			url: urlFor(id),
			createdAt: opts.createdAt ?? new Date().toISOString()
		}
	});
}

function tamperReasonLogged(reason: string): boolean {
	return warnSpy.mock.calls.some(
		([msg, details]: unknown[]) =>
			msg === '[pds-sync] skipped record' &&
			(details as { reason?: string } | undefined)?.reason === reason
	);
}

beforeEach(() => {
	resetStores();
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
});

describe('resolveAnsweredContent: 回答済み表示のPDS read-through', () => {
	it('未回答メッセージは null を返す', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '質問', senderDid: null, answer: null });

		await expect(resolveAnsweredContent(env, getStoredMessage(currentId)!)).resolves.toBeNull();
	});

	it('匿名の回答済みメッセージは回答PDSレコードの本文と画像を正として使い、DBを書き換えない', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: 'DBの古い質問',
			senderDid: null,
			answer: 'DBの古い回答',
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri(),
			imageKeys: ['messages/2026/01/abc-0.jpg']
		});
		seedAnswerRecord('PDSの回答', 'PDSの質問', nextCid(), {
			named: false,
			images: [{ image: { ref: { $link: 'bafkreianswerimage' } }, alt: '' }]
		});

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);

		expect(resolved).toEqual({
			body: 'PDSの質問',
			answer: 'PDSの回答',
			imageUrls: [`https://cdn.bsky.app/img/feed_fullsize/plain/${CREATOR}/bafkreianswerimage@jpeg`]
		});
		expect(getStoredMessage(currentId)!.body).toBe('DBの古い質問');
		expect(getStoredMessage(currentId)!.answer).toBe('DBの古い回答');
	});

	it('記名質問がPDS上で健在・cid一致なら、ライブの質問内容を表示する', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: 'DBキャッシュ',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('ライブの質問内容', qCid);
		seedAnswerRecord('記名への回答', '回答時点の質問', nextCid(), { named: true, questionRefCid: qCid });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);

		expect(resolved).toMatchObject({ body: 'ライブの質問内容', answer: '記名への回答' });
	});

	it('記名質問が取り下げ済み、または回答後に書き換え済みなら null を返す', async () => {
		const withdrawnId = newMessageId();
		currentId = withdrawnId;
		seedMessage({
			id: withdrawnId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedAnswerRecord('回答', '記名の質問', nextCid(), { named: true });

		await expect(resolveAnsweredContent(env, getStoredMessage(withdrawnId)!)).resolves.toBeNull();

		const tamperedId = newMessageId();
		currentId = tamperedId;
		const qCid = nextCid();
		seedMessage({
			id: tamperedId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('回答', '記名の質問', nextCid(), { named: true, questionRefCid: qCid });
		tamperRecord(questionUri(), { value: { text: '改ざんされた質問' }, cid: nextCid() });

		await expect(resolveAnsweredContent(env, getStoredMessage(tamperedId)!)).resolves.toBeNull();
		expect(tamperReasonLogged('question-edited-after-answered')).toBe(true);
	});
});

describe('質問表示のPDSライブ判定', () => {
	it('匿名質問はPDS質問レコード無しでも表示対象になる', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '匿名の質問', senderDid: null });

		await expect(isQuestionVisibleFromPds(getStoredMessage(currentId)!)).resolves.toBe(true);
	});

	it('記名質問でPDS質問レコードが404の場合は一覧と未読数から除外される', async () => {
		const anonymousId = newMessageId();
		const namedId = newMessageId();
		seedMessage({ id: anonymousId, creatorDid: CREATOR, body: '匿名の質問', senderDid: null });
		seedMessage({
			id: namedId,
			creatorDid: CREATOR,
			body: '取り下げ済みの記名質問',
			senderDid: SENDER,
			questionRecordUri: questionUri()
		});
		currentId = namedId;
		seedQuestionRecord('取り下げ前の記名質問', nextCid());
		removeRecord(questionUri());

		const filtered = await filterMessagesByLiveQuestion([
			getStoredMessage(anonymousId)!,
			getStoredMessage(namedId)!
		]);

		expect(filtered.map((m) => m.id)).toEqual([anonymousId]);
		await expect(countVisibleUnread(env, CREATOR)).resolves.toBe(1);
	});

	it('resolveQuestionContent は記名質問をPDSから、匿名質問をDB/R2キーから解決する', async () => {
		const namedId = newMessageId();
		currentId = namedId;
		seedMessage({
			id: namedId,
			creatorDid: CREATOR,
			body: '',
			senderDid: SENDER,
			questionRecordUri: questionUri()
		});
		seedQuestionRecord('PDSの記名質問', nextCid());

		await expect(resolveQuestionContent(getStoredMessage(namedId)!)).resolves.toMatchObject({
			body: 'PDSの記名質問',
			senderDid: SENDER
		});

		const anonymousId = newMessageId();
		seedMessage({
			id: anonymousId,
			creatorDid: CREATOR,
			body: '匿名質問',
			senderDid: null,
			imageKeys: ['messages/2026/01/anon.jpg']
		});

		await expect(resolveQuestionContent(getStoredMessage(anonymousId)!)).resolves.toEqual({
			body: '匿名質問',
			imageUrls: ['/api/images/messages/2026/01/anon.jpg'],
			senderDid: null
		});
	});
});

describe('PDSからの一覧・詳細読み取り', () => {
	it('回答済み詳細はDB行が無くてもanswerレコードから復元できる', async () => {
		currentId = newMessageId();
		seedAnswerRecord('回答', '匿名質問', nextCid(), { named: false });

		const message = await getAnsweredMessageFromPdsById(env, CREATOR, APP_URL, currentId);

		expect(message).toMatchObject({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名質問',
			answer: '回答',
			answerRecordUri: answerUri()
		});
	});

	it('回答済み一覧はPDS answerレコードを新しい順に返す', async () => {
		const oldId = newMessageId();
		const newId = newMessageId();
		seedAnswerRecord('古い回答', '古い質問', nextCid(), {
			named: false,
			rkey: 'old',
			id: oldId,
			createdAt: '2026-01-01T00:00:00.000Z'
		});
		seedAnswerRecord('新しい回答', '新しい質問', nextCid(), {
			named: false,
			rkey: 'new',
			id: newId,
			createdAt: '2026-01-02T00:00:00.000Z'
		});

		const messages = await getAnsweredMessagesFromPds(env, CREATOR, APP_URL, { limit: 2 });

		expect(messages.map((m) => m.id)).toEqual([newId, oldId]);
	});

	it('送信済み一覧は送信者PDSのquestionレコードを返す', async () => {
		currentId = newMessageId();
		seedQuestionRecord('送信済み質問', nextCid());

		const messages = await getSentMessagesFromPds(env, SENDER, APP_URL, { limit: 1 });

		expect(messages).toHaveLength(1);
		expect(messages[0]).toMatchObject({
			id: currentId,
			creatorDid: CREATOR,
			body: '送信済み質問',
			senderDid: SENDER,
			questionRecordUri: questionUri()
		});
	});
});
