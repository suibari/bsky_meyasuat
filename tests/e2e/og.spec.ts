import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { E2E_PORT, USER_HANDLE, sessionCookieValue } from './fixtures';

function pngSize(body: Uint8Array): { width: number; height: number } {
	const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function login(page: Page) {
	await page.context().addCookies([
		{ name: 'meyasuat_session', value: sessionCookieValue(), url: `http://127.0.0.1:${E2E_PORT}` }
	]);
}

// /api/og/u/... はURL単位でエッジキャッシュされるので、テストごとに別の ?v= を使う
function uniqueVersion(): string {
	return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ブラウザで publishOgImage(描画→R2へPUT)を実行し、生成した画像のハッシュを返す
async function publishInBrowser(page: Page, messageId?: string): Promise<{ hash: string; size: number }> {
	return page.evaluate(
		async ({ handle, messageId }) => {
			// Vite dev サーバーが配信するソースを直接読み込んで、ブラウザ上で実行する
			const modulePath = '/src/lib/client/og.ts';
			const mod: typeof import('../../src/lib/client/og') = await import(/* @vite-ignore */ modulePath);
			const blob = await mod.publishOgImage(handle, messageId);
			const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
			const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
			return { hash, size: blob.size };
		},
		{ handle: USER_HANDLE, messageId }
	);
}

test.describe('OGP設定プレビュー(ブラウザ描画)', () => {
	test('サーバーに描画させずにbox/messageを表示し、背景を選ぶと描き直す', async ({ page }) => {
		await login(page);
		const ogRequests: string[] = [];
		page.on('request', (req) => {
			const { pathname } = new URL(req.url());
			if (pathname.startsWith('/api/og/')) ogRequests.push(`${req.method()} ${pathname}`);
		});
		await page.goto('/dashboard/settings');

		const previews = page.locator('img[src^="blob:"]');
		const naturalWidths = () => previews.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).naturalWidth));
		await expect.poll(naturalWidths).toEqual([1200, 1200]);
		const before = await previews.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));

		await page.locator('input[type="file"]').setInputFiles('static/ogp.png');
		await page.getByRole('button', { name: 'この範囲で決定' }).click();
		// アップローダーのプレビュー(1200x630にクロップ済みの背景)＋描き直されたOGPプレビュー2枚
		const ogPreviewSrcs = async () =>
			(await previews.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src))).slice(1);
		await expect.poll(async () => (await ogPreviewSrcs()).some((src) => before.includes(src))).toBe(false);
		await expect.poll(naturalWidths).toEqual([1200, 1200, 1200]);

		// 描画はブラウザで完結し、OGP関連のAPI(旧 /api/og/preview を含む)は一切呼ばれない
		expect(ogRequests).toEqual([]);
	});
});

test.describe('OGP画像の事前生成とR2配信', () => {
	test('箱: ブラウザで生成してPUTした画像がそのまま配信される', async ({ page }) => {
		await login(page);
		await page.goto('/dashboard/settings');
		const published = await publishInBrowser(page);

		const res = await page.request.get(`/api/og/u/${USER_HANDLE}?v=${uniqueVersion()}`);
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toBe('image/png');
		expect(res.headers()['cache-control']).toContain('max-age=86400');
		const body = await res.body();
		expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
		expect(sha256(body)).toBe(published.hash);
	});

	test('メッセージ: 未生成ならサーバーで描画し、生成後はPUTした画像を配信する', async ({ page }) => {
		await login(page);
		await page.goto('/dashboard/settings');
		const messageId = `e2e-message-${uniqueVersion()}`;

		const fallback = await page.request.get(`/api/og/u/${USER_HANDLE}/m/${messageId}?v=${uniqueVersion()}`);
		expect(fallback.status()).toBe(200);
		expect(pngSize(await fallback.body())).toEqual({ width: 1200, height: 630 });

		const published = await publishInBrowser(page, messageId);
		const res = await page.request.get(`/api/og/u/${USER_HANDLE}/m/${messageId}?v=${uniqueVersion()}`);
		expect(res.status()).toBe(200);
		expect(sha256(await res.body())).toBe(published.hash);
	});

	test('PUTは本人のログインと1200x630のPNGを要求する', async ({ page, request }) => {
		const pngHeader = (width: number, height: number) => {
			const buf = new Uint8Array(33);
			buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
			new DataView(buf.buffer).setUint32(16, width);
			new DataView(buf.buffer).setUint32(20, height);
			return Buffer.from(buf);
		};

		const anonymous = await request.put(`/api/og/u/${USER_HANDLE}`, { data: pngHeader(1200, 630) });
		expect(anonymous.status()).toBe(401);

		await login(page);
		const notPng = await page.request.put(`/api/og/u/${USER_HANDLE}`, { data: Buffer.from('not a png') });
		expect(notPng.status()).toBe(400);
		const wrongSize = await page.request.put(`/api/og/u/${USER_HANDLE}`, { data: pngHeader(100, 100) });
		expect(wrongSize.status()).toBe(400);
	});

	test('描画用のspecと画像プロキシはログイン必須で、プロキシはBluesky CDNに限る', async ({ page, request }) => {
		expect((await request.get(`/api/og/spec/u/${USER_HANDLE}`)).status()).toBe(401);
		expect((await request.get(`/api/og/image-proxy?url=${encodeURIComponent('https://cdn.bsky.app/img/x')}`)).status()).toBe(401);

		await login(page);
		const spec = await page.request.get(`/api/og/spec/u/${USER_HANDLE}`);
		expect(spec.status()).toBe(200);
		expect(await spec.json()).toMatchObject({ kind: 'box', handle: USER_HANDLE, backgroundUrl: null });
		const outside = await page.request.get(`/api/og/image-proxy?url=${encodeURIComponent('https://example.com/a.png')}`);
		expect(outside.status()).toBe(400);
	});
});

test.describe('シェアモーダル', () => {
	test('開くとOGP画像をブラウザで生成・保存して表示する', async ({ page }) => {
		await login(page);
		await page.goto('/dashboard');
		const put = page.waitForResponse(
			(res) => res.request().method() === 'PUT' && new URL(res.url()).pathname === `/api/og/u/${USER_HANDLE}`
		);
		// SSR直後はハイドレーション前でクリックが効かないことがあるので、ダイアログが開くまで押し直す
		await expect(async () => {
			await page.getByRole('button', { name: 'シェア', exact: true }).click();
			await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1000 });
		}).toPass();
		expect((await put).status()).toBe(204);

		const modalImage = page.getByRole('img', { name: 'OGP' });
		await expect(modalImage).toHaveAttribute('src', /^blob:/);
		await expect.poll(() => modalImage.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(1200);
	});
});

test.describe('Blueskyリンクカードのサムネ上限(1MB)対策', () => {
	test('上限内のOGP画像はPNGのまま、上限超過ならJPEGで1MB以内に収める', async ({ page }) => {
		await page.goto('/');
		const result = await page.evaluate(async (handle) => {
			// Vite dev サーバーが配信するソースを直接読み込んで、ブラウザ上で実行する
			const modulePath = '/src/lib/client/oauthClient.ts';
			const mod: typeof import('../../src/lib/client/oauthClient') = await import(/* @vite-ignore */ modulePath);

			const og = await (await fetch(`/api/og/u/${handle}?v=e2e`)).blob();
			const ogFitted = await mod.fitExternalThumbBlob(og);

			// 写真のように圧縮が効かない画像(ランダムノイズ)で1MB超のPNGを作る
			const canvas = new OffscreenCanvas(1200, 630);
			const ctx = canvas.getContext('2d')!;
			const data = ctx.createImageData(1200, 630);
			for (let i = 0; i < data.data.length; i++) data.data[i] = i % 4 === 3 ? 255 : Math.random() * 256;
			ctx.putImageData(data, 0, 0);
			const big = await canvas.convertToBlob({ type: 'image/png' });
			const bigFitted = await mod.fitExternalThumbBlob(big);
			const bitmap = await createImageBitmap(bigFitted);

			return {
				limit: mod.EXTERNAL_THUMB_MAX_BYTES,
				ogUnchanged: ogFitted === og,
				ogType: ogFitted.type,
				bigSize: big.size,
				bigFittedSize: bigFitted.size,
				bigFittedType: bigFitted.type,
				bigFittedDims: [bitmap.width, bitmap.height]
			};
		}, USER_HANDLE);

		expect(result.limit).toBe(1_000_000);
		expect(result.ogUnchanged).toBe(true);
		expect(result.ogType).toBe('image/png');
		expect(result.bigSize).toBeGreaterThan(1_000_000);
		expect(result.bigFittedType).toBe('image/jpeg');
		expect(result.bigFittedSize).toBeLessThanOrEqual(1_000_000);
		expect(result.bigFittedDims).toEqual([1200, 630]);
	});
});
