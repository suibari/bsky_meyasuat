import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getUserByDid, createMessage, checkRateLimit, logRateLimit } from '$lib/server/db.js';
import { uploadToR2, messageImageKey } from '$lib/server/r2.js';
import { verifyTurnstile } from '$lib/server/turnstile.js';
import { notifyCreator } from '$lib/server/bot.js';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX = 5;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

async function hashIp(ip: string, secret: string): Promise<string> {
	const data = new TextEncoder().encode(ip + secret);
	const buf = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	const ctx = platform?.context;
	if (!env) error(503, 'Service unavailable');

	const fd = await request.formData();
	const body = (fd.get('body') as string | null)?.trim() ?? '';
	const creatorDid = (fd.get('creator_did') as string | null) ?? '';
	const turnstileToken = (fd.get('turnstile_token') as string | null) ?? '';
	const imageFiles = fd.getAll('images') as File[];

	// バリデーション
	if (!body) error(400, 'Message body is required');
	if (body.length > 1000) error(400, 'Message too long');
	if (!creatorDid.startsWith('did:')) error(400, 'Invalid creator');
	if (imageFiles.length > 4) error(400, 'Too many images');

	// Turnstile 検証
	const ip = request.headers.get('CF-Connecting-IP') ?? '';
	const turnstileOk = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip || undefined);
	if (!turnstileOk) error(403, 'Turnstile verification failed');

	// IP レートリミット
	const ipHash = await hashIp(ip || 'unknown', env.SESSION_SECRET);
	const allowed = await checkRateLimit(env, ipHash, creatorDid, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
	if (!allowed) error(429, 'Rate limit exceeded');

	// 募集者存在確認
	const creator = await getUserByDid(env, creatorDid);
	if (!creator) error(404, 'Creator not found');

	// 画像をアップロード
	const imageKeys: string[] = [];
	const messageId = crypto.randomUUID();
	for (let i = 0; i < imageFiles.length; i++) {
		const file = imageFiles[i];
		if (!ALLOWED_MIME.has(file.type)) error(400, `Invalid image type: ${file.type}`);
		const buf = await file.arrayBuffer();
		if (buf.byteLength > MAX_IMAGE_SIZE) error(400, 'Image too large');
		const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
		const key = messageImageKey(messageId, i, ext);
		await uploadToR2(env, key, buf, file.type);
		imageKeys.push(key);
	}

	// メッセージ保存 (id を指定して INSERT)
	const message = await createMessage(env, {
		creatorDid,
		body,
		imageKeys,
		ipHash
	});

	// レートリミットログ
	await logRateLimit(env, ipHash, creatorDid);

	// Bot 通知 (fire-and-forget)
	if (creator.notifyEnabled && ctx) {
		ctx.waitUntil(notifyCreator(env, message.id, creator.did, creator.handle));
	}

	return json({ ok: true, messageId: message.id });
};
