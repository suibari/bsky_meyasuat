// =============================================================================
// 質問回答トランザクション／改ざん検知のテスト
//
// db.ts / atproto.ts をインメモリ偽実装（helpers/pdsSyncStores.ts）に差し替え、
// pdsSync.ts の ingest / reconcile を実際に駆動して検証する。
//
// 改ざん検知モデル（Phase 3以降）:
//   - 質問(送信者所有): 未回答の間は常に最新のPDS内容へ追従する（凍結なし）。
//     回答が付いた瞬間に凍結され、以後の送信者側の編集は反映されない。
//     回答後の書き換えは、回答レコード自身が刻む questionRef.cid と質問の
//     現在のcidを突合することで検知する（DB側にcid台帳は持たない）。
//   - 回答(箱主所有): 本人の編集は常に正当な変更として追従する（凍結なし）。
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// pdsSync が使う import 指定子とまったく同じ指定子でモックする。
vi.mock('$lib/server/db.js', async () => (await import('./helpers/pdsSyncStores')).fakeDb);
vi.mock('$lib/server/atproto.js', async () => (await import('./helpers/pdsSyncStores')).fakeAtproto);

import { ingestCreatesFromPdsForUser, reconcileMessageWithPds, resolveAnsweredContent } from '$lib/server/pdsSync.js';
import {
	getStoredMessage,
	nextCid,
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

/**
 * 回答レコードを作成者PDSへ投入する。subject/questionRef で匿名・記名を切替。
 * questionRefCid を渡すと、回答時点の質問cidを刻んだ状態を再現できる
 * （reconcileMessageWithPds の改ざん検知はこのcidと質問の現在cidを突合する）。
 */
function seedAnswerRecord(
	answer: string,
	question: string,
	cid: string,
	opts: { named: boolean; questionRefCid?: string }
): void {
	seedPdsRecord({
		uri: answerUri(),
		cid,
		value: {
			answer,
			question,
			subject: opts.named ? SENDER : null,
			questionRef: opts.named
				? { uri: questionUri(), ...(opts.questionRefCid ? { cid: opts.questionRefCid } : {}) }
				: undefined,
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
	});

	// ---- 2. 匿名質問への回答 ----------------------------------------------
	it('匿名質問への回答: ingestが回答レコードのuriを初回確定する', async () => {
		currentId = newMessageId();
		const cid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名の質問',
			senderDid: null,
			answer: '回答です',
			answeredAt: new Date().toISOString()
		});
		seedAnswerRecord('回答です', '匿名の質問', cid, { named: false });

		const changed = await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(true);
		expect(m.answer).toBe('回答です');
		expect(m.answerRecordUri).toBe(answerUri());
	});

	// ---- 3. 匿名質問への回答を本人が編集 -----------------------------------
	it('匿名質問への回答: 箱主本人による編集は正当な変更として追従する', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名の質問',
			senderDid: null,
			answer: '最初の回答',
			answeredAt: new Date().toISOString()
		});
		seedAnswerRecord('最初の回答', '匿名の質問', nextCid(), { named: false });
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL); // 初回確定

		// 箱主が自分のPDS上で回答を編集（正当な変更。改ざんではない）
		tamperRecord(answerUri(), { value: { answer: '編集後の回答' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(m.answer).toBe('編集後の回答'); // 追従する（凍結しない）
	});

	// ---- 4. 記名質問 -------------------------------------------------------
	it('記名質問: ingestが質問レコードのuriを初回確定する', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '記名の質問', senderDid: SENDER });
		seedQuestionRecord('記名の質問', nextCid());

		const changed = await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(true);
		expect(m.body).toBe('記名の質問');
		expect(m.questionRecordUri).toBe(questionUri());
	});

	// ---- 5. 記名質問(未回答)を送信者が編集 ---------------------------------
	it('記名質問で未回答時の編集: まだ回答が無いので最新のPDS内容へ追従する', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '記名の質問', senderDid: SENDER });
		seedQuestionRecord('記名の質問', nextCid());
		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL); // 初回取り込み

		// 未回答のうちに送信者が質問を編集(誤字修正など)
		tamperRecord(questionUri(), { value: { text: '編集後の質問' }, cid: nextCid() });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('編集後の質問'); // 追従する（凍結しない）
	});

	// ---- 6. 記名質問への回答 ----------------------------------------------
	it('記名質問への回答: 質問・回答レコード両方のuriが確定する', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString()
		});
		seedQuestionRecord('記名の質問', nextCid());
		seedAnswerRecord('記名への回答', '記名の質問', nextCid(), { named: true });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL); // 質問確定
		await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL); // 回答確定

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('記名の質問');
		expect(m.answer).toBe('記名への回答');
		expect(m.questionRecordUri).toBe(questionUri());
		expect(m.answerRecordUri).toBe(answerUri());
	});

	// ---- 7〜9. 回答後の改ざん・正当編集の検知は resolveAnsweredContent の責務 ----
	// （ingest/reconcileはDB本文を書き換えないため、表示時のライブ判定を直接検証する。
	//   下の「resolveAnsweredContent」describeブロックにまとめて存在する）

	// ---- 補助: 回答削除は reconcileMessageWithPds が検知し再回答可能にする ----
	it('参考: 回答レコードがPDSから消えた場合、reconcileMessageWithPdsが削除として追従する', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		// 回答レコードをPDSへ投入しない＝箱主が削除済み(404)

		const changed = await reconcileMessageWithPds(env, getStoredMessage(currentId)!);

		expect(changed).toBe(true);
		const m = getStoredMessage(currentId)!;
		expect(m.answer).toBeNull();
		expect(m.answerRecordUri).toBeNull();
	});
});

// ---- resolveAnsweredContent（Phase 4: 回答済み一覧のread-through）--------------
describe('resolveAnsweredContent: 回答済み一覧のPDS read-through', () => {
	it('未回答メッセージは null（一覧から除外）', async () => {
		currentId = newMessageId();
		seedMessage({ id: currentId, creatorDid: CREATOR, body: '質問', senderDid: null, answer: null });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toBeNull();
	});

	it('回答レコード未同期(レガシー)の場合はDBキャッシュへフォールバックする', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: 'DBの質問',
			senderDid: null,
			answer: 'DBの回答',
			answeredAt: new Date().toISOString(),
			answerRecordUri: null // PDSへの書き込みが過去に失敗したケース
		});

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toEqual({ body: 'DBの質問', answer: 'DBの回答', imageUrls: [] });
	});

	it('回答レコードが生きていれば、その内容を正として使う（DBキャッシュより優先）', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '古い質問キャッシュ',
			senderDid: null,
			answer: '古い回答キャッシュ',
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri()
		});
		seedAnswerRecord('最新の回答', '最新の質問', nextCid(), { named: false });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toEqual({ body: '最新の質問', answer: '最新の回答', imageUrls: [] });
	});

	it('回答レコードがPDS上で削除済みなら null（一覧から除外）', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '質問',
			senderDid: null,
			answer: '回答',
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri()
		});
		// 回答レコードをPDSへ投入しない＝404相当

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toBeNull();
	});

	// 【設計】記名質問はスナップショットを使わず、常にライブの質問レコードを正とする。
	// 取り下げ(404)・改ざん(cid不一致)はどちらも「表示しない」で統一し、DBの永続
	// フラグ(旧sender_deleted_at依存)を持たない。

	it('記名質問がPDS上で健在・cid一致なら、ライブの質問内容を表示する', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: 'DBキャッシュ(古い)',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('ライブの質問内容', qCid);
		seedAnswerRecord('記名への回答', '記名の質問(スナップショット)', nextCid(), { named: true, questionRefCid: qCid });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).not.toBeNull();
		expect(resolved!.body).toBe('ライブの質問内容'); // スナップショットではなくライブの内容
		expect(resolved!.answer).toBe('記名への回答');
	});

	it('送信者が質問を取り下げた(404)場合: nullを返す（一覧から除外）', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		// 質問レコードは投入しない＝送信者が削除済み(404)
		seedAnswerRecord('記名への回答', '記名の質問', nextCid(), { named: true });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toBeNull();
	});

	it('回答後に質問が書き換えられた(cid不一致・改ざん)場合: nullを返しログを残す', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('記名の質問', qCid);
		seedAnswerRecord('記名への回答', '記名の質問', nextCid(), { named: true, questionRefCid: qCid });
		// 回答後に送信者が質問を書き換える（改ざん）
		tamperRecord(questionUri(), { value: { text: '改ざんされた質問' }, cid: nextCid() });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toBeNull();
		expect(tamperReasonLogged('question-edited-after-answered')).toBe(true);
	});

	it('箱主が自分の回答を編集していても、質問が健在・cid一致なら正しく表示する', async () => {
		currentId = newMessageId();
		const qCid = nextCid();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '記名の質問',
			senderDid: SENDER,
			answer: '記名への回答',
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('記名の質問', qCid);
		// 回答レコード自体が既に編集済みの内容として存在する（本人の正当な編集）
		seedAnswerRecord('編集後の回答', '記名の質問', nextCid(), { named: true, questionRefCid: qCid });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).not.toBeNull();
		expect(resolved!.answer).toBe('編集後の回答');
		expect(resolved!.body).toBe('記名の質問');
		expect(tamperReasonLogged('question-edited-after-answered')).toBe(false);
	});

	it('匿名の回答済みメッセージはR2の画像キーからimageUrlsを組み立てる', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '匿名の質問',
			senderDid: null,
			answer: '匿名への回答',
			answeredAt: new Date().toISOString(),
			answerRecordUri: null,
			imageKeys: ['messages/2026/01/abc-0.jpg']
		});

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved?.imageUrls).toEqual(['/api/images/messages/2026/01/abc-0.jpg']);
	});
});

// ---- Phase 5: DB本文キャッシュの剪定 ------------------------------------------
describe('Phase 5: 回答済み本文の剪定とingestの整合性', () => {
	it('PDSで内容を確認できたら、DBのbody/answerを剪定する', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '古いキャッシュの質問',
			senderDid: null,
			answer: '古いキャッシュの回答',
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri()
		});
		seedAnswerRecord('回答', '質問', nextCid(), { named: false });

		await resolveAnsweredContent(env, getStoredMessage(currentId)!);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe('');
		expect(m.answer).toBe('');
	});

	it('剪定済み(body/answerが空文字列)の行は、回答ingestで復元されない', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '', // 剪定済み
			senderDid: null,
			answer: '', // 剪定済み
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri()
		});
		seedAnswerRecord('生きている回答', '生きている質問', nextCid(), { named: false });

		const changed = await ingestCreatesFromPdsForUser(env, CREATOR, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(changed).toBe(false);
		expect(m.body).toBe(''); // 復元されない
		expect(m.answer).toBe(''); // 復元されない
	});

	it('剪定済みでも表示時(resolveAnsweredContent)はPDSから正しく内容を解決できる', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '',
			senderDid: null,
			answer: '',
			answeredAt: new Date().toISOString(),
			answerRecordUri: answerUri()
		});
		seedAnswerRecord('生きている回答', '生きている質問', nextCid(), { named: false });

		const resolved = await resolveAnsweredContent(env, getStoredMessage(currentId)!);
		expect(resolved).toEqual({ body: '生きている質問', answer: '生きている回答', imageUrls: [] });
	});

	it('記名質問で回答済み(剪定済み)の場合、質問ingestの凍結ゲートはanswerではなくansweredAtで判定される', async () => {
		currentId = newMessageId();
		seedMessage({
			id: currentId,
			creatorDid: CREATOR,
			body: '', // 剪定済み
			senderDid: SENDER,
			answer: '', // 剪定済み
			answeredAt: new Date().toISOString(),
			questionRecordUri: questionUri(),
			answerRecordUri: answerUri()
		});
		seedQuestionRecord('送信者PDS上の最新質問', nextCid());
		seedAnswerRecord('回答', '回答時点の質問', nextCid(), { named: true });

		await ingestCreatesFromPdsForUser(env, SENDER, APP_URL);

		const m = getStoredMessage(currentId)!;
		expect(m.body).toBe(''); // 空文字列のまま復元されない(=誤ってfalsy判定されて追従していない)
	});
});
