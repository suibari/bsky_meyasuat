// =============================================================================
// 質問回答トランザクション／改ざん検知のテスト（ユーザーが挙げた9パターン）
//
// db.ts / atproto.ts をインメモリ偽実装（helpers/pdsSyncStores.ts）に差し替え、
// pdsSync.ts の ingest / reconcile を実際に駆動して「初回cid確定 → 改ざん →
// 本文・cidが凍結されたまま」を本文レベルで検証する。
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// pdsSync が使う import 指定子とまったく同じ指定子でモックする。
vi.mock('$lib/server/db.js', async () => (await import('./helpers/pdsSyncStores')).fakeDb);
vi.mock('$lib/server/atproto.js', async () => (await import('./helpers/pdsSyncStores')).fakeAtproto);

import { ingestCreatesFromPdsForUser, reconcileMessageWithPds } from '$lib/server/pdsSync.js';
import {
	getStoredMessage,
	nextCid,
	removeRecord,
	resetStores,
	seedMessage,
	seedPdsRecord,
	tamperRecord
} from './helpers/pdsSyncStores.js';

// ---- 定数・ビルダ ---------------------------------------------------------
const APP_URL = 'http://localhost:5173';
const CREATOR = 'did:plc:creator';
const SENDER = 'did:plc:sender';
const HANDLE = 'alice';
const QUESTION_COLLECTION = 'com.suibari.meyasuat.question';
const ANSWER_COLLECTION = 'com.suibari.meyasuat.answer';

// env は偽実装が無視するので、pdsSync 側の型を借用して App 型への直接依存を避ける。
const env = {} as Parameters<typeof ingestCreatesFromPdsForUser>[0];

function newMessageId(): string {
	return crypto.randomUUID(); // 36桁（pdsSync の url 正規表現に一致）
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

// console.warn を監視して tamper ログの発火を判定する。
let warnSpy: ReturnType<typeof vi.spyOn>;

function tamperReasonLogged(reason: string): boolean {
	return warnSpy.mock.calls.some(
		([msg, details]) =>
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

// ---- シナリオ・セットアップ用ヘルパー -------------------------------------

/** 記名質問レコードを送信者PDSへ投入する。 */
function seedQuestionRecord(text: string, cid: string): void {
	seedPdsRecord({
		uri: questionUri(),
		cid,
		value: { text, subject: CREATOR, url: urlFor(currentId), createdAt: new Date().toISOString() }
	});
}

/** 回答レコードを作成者PDSへ投入する。subject/questionRef で匿名・記名を切替。 */
function seedAnswerRecord(
	answer: string,
	question: string,
	cid: string,
	opts: { named: boolean }
): void {
	seedPdsRecord({
		uri: answerUri(),
		cid,
		value: {
			answer,
			question,
			subject: opts.named ? SENDER : null,
			questionRef: opts.named ? { uri: questionUri() } : undefined,
			url: urlFor(currentId),
			createdAt: new Date().toISOString()
		}
	});
}

// 各テストで使うメッセージID（ビルダで url を組み立てるため共有）。
let currentId: string;

describe('質問回答トランザクション / 改ざん検知', () => {
	// ---- 1. 匿名質問 -------------------------------------------------------
	it('匿名質問: sender_did=null・PDS質問レコード無し。ingestは何も変更しない', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '匿名の質問', senderDid: null });

		const changed = await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(false);
		expect(m.body).toBe('匿名の質問');
		expect(m.senderDid).toBeNull();
		expect(m.questionRecordUri).toBeNull();
		expect(m.questionRecordCid).toBeNull();
	});

	// ---- 2. 匿名質問への回答 ----------------------------------------------
	it('匿名質問への回答: ingestが回答レコードのcidを初回確定する', async () => {
		currentId = newMessageId();
		const capturedCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名の質問',
			senderDid: null,
			answer: '回答です',
			answeredAt: new Date().toISOString()
		});
		seedAnswerRecord('回答です', '匿名の質問', capturedCid, { named: false });

		const changed = await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(true);
		expect(m.answer).toBe('回答です');
		expect(m.answerRecordUri).toBe(answerUri());
		expect(m.answerRecordCid).toBe(capturedCid);
	});

	// ---- 3. 匿名質問への回答の改ざん --------------------------------------
	it('匿名質問への回答の改ざん: cid確定後の回答編集はブロックされ凍結される', async () => {
		currentId = newMessageId();
		const capturedCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名の質問',
			senderDid: null,
			answer: '正しい回答',
			answeredAt: new Date().toISOString()
		});
		seedAnswerRecord('正しい回答', '匿名の質問', capturedCid, { named: false });
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL); // 初回確定

		// PDS上で回答を改ざん（内容変更＝cid変化）
		tamperRecord(answerUri(), { value: { answer: '改ざんされた回答' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.answer).toBe('正しい回答'); // 凍結（改ざん反映されない）
		expect(m.answerRecordCid).toBe(capturedCid); // cidも不変
		expect(tamperReasonLogged('answer-cid-mismatch-tamper-blocked')).toBe(true);
	});

	// ---- 4. 記名質問 -------------------------------------------------------
	it('記名質問: ingestが質問レコードのcidを初回確定し本文を凍結する', async () => {
		currentId = newMessageId();
		const capturedCid = nextCid();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '記名の質問', senderDid: SENDER });
		seedQuestionRecord('記名の質問', capturedCid);

		const changed = await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(true);
		expect(m.body).toBe('記名の質問');
		expect(m.questionRecordUri).toBe(questionUri());
		expect(m.questionRecordCid).toBe(capturedCid);
	});

	// ---- 5. 記名質問(未回答)の質問改ざん ----------------------------------
	it('記名質問で未回答時の質問改ざん: cid確定後の質問編集はブロックされ凍結される', async () => {
		currentId = newMessageId();
		const capturedCid = nextCid();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '記名の質問', senderDid: SENDER });
		seedQuestionRecord('記名の質問', capturedCid);
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL); // 初回確定

		tamperRecord(questionUri(), { value: { text: '改ざんされた質問' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('記名の質問'); // 凍結
		expect(m.questionRecordCid).toBe(capturedCid);
		expect(tamperReasonLogged('question-cid-mismatch-tamper-blocked')).toBe(true);
	});

	// ---- 6. 記名質問への回答 ----------------------------------------------
	it('記名質問への回答: 質問・回答レコード両方のcidが確定する', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		const aCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('記名への回答', '記名の質問', aCid, { named: true });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL); // 質問確定
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL); // 回答確定

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('記名の質問');
		expect(m.answer).toBe('記名への回答');
		expect(m.questionRecordCid).toBe(qCid);
		expect(m.answerRecordCid).toBe(aCid);
	});

	// ---- 7. 記名質問への回答の質問改ざん ----------------------------------
	it('記名質問への回答後の質問改ざん: 質問だけ凍結され回答は健全', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		const aCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('記名への回答', '記名の質問', aCid, { named: true });
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		tamperRecord(questionUri(), { value: { text: '改ざんされた質問' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('記名の質問'); // 質問は凍結
		expect(m.questionRecordCid).toBe(qCid);
		expect(m.answer).toBe('記名への回答'); // 回答は健全
		expect(m.answerRecordCid).toBe(aCid);
		expect(tamperReasonLogged('question-cid-mismatch-tamper-blocked')).toBe(true);
		expect(tamperReasonLogged('answer-cid-mismatch-tamper-blocked')).toBe(false);
	});

	// ---- 8. 記名質問への回答の回答改ざん ----------------------------------
	it('記名質問への回答後の回答改ざん: 回答だけ凍結され質問は健全', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		const aCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('記名への回答', '記名の質問', aCid, { named: true });
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		tamperRecord(answerUri(), { value: { answer: '改ざんされた回答' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.answer).toBe('記名への回答'); // 回答は凍結
		expect(m.answerRecordCid).toBe(aCid);
		expect(m.body).toBe('記名の質問'); // 質問は健全
		expect(m.questionRecordCid).toBe(qCid);
		expect(tamperReasonLogged('answer-cid-mismatch-tamper-blocked')).toBe(true);
		expect(tamperReasonLogged('question-cid-mismatch-tamper-blocked')).toBe(false);
	});

	// ---- 9. 記名質問への回答の質問および回答改ざん ------------------------
	it('記名質問への回答後の質問+回答の同時改ざん: 両方凍結される', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		const aCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('記名への回答', '記名の質問', aCid, { named: true });
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		tamperRecord(questionUri(), { value: { text: '改ざん質問' }, cid: nextCid() });
		tamperRecord(answerUri(), { value: { answer: '改ざん回答' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('記名の質問'); // 質問凍結
		expect(m.questionRecordCid).toBe(qCid);
		expect(m.answer).toBe('記名への回答'); // 回答凍結
		expect(m.answerRecordCid).toBe(aCid);
		expect(tamperReasonLogged('question-cid-mismatch-tamper-blocked')).toBe(true);
		expect(tamperReasonLogged('answer-cid-mismatch-tamper-blocked')).toBe(true);
	});

	// ---- 補助: 正当な削除は追従する（凍結方式が削除を妨げないことの確認）----
	it('参考: PDSからレコードが消えた場合は削除として追従する（改ざん扱いしない）', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '記名の質問', senderDid: SENDER });
		seedQuestionRecord('記名の質問', qCid);
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);

		removeRecord(questionUri()); // 送信者が質問を削除
		await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.senderDeletedAt).not.toBeNull();
		expect(m.questionRecordUri).toBeNull();
	});
});
