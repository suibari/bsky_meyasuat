import { expect, test, type Page } from '@playwright/test';
import { E2E_PORT, USER_HANDLE, sessionCookieValue } from './fixtures';

function pngSize(body: Uint8Array): { width: number; height: number } {
	const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

type PreviewCall = { variant: string | null; hasBackground: boolean; status: number; type: string | null };

// 背景画像(Blob)を含む multipart は Playwright から本文を読めず、レスポンス本文も fetch→blob で
// 消費されて読めないため、ページ側で fetch を包んで /api/og/preview の呼び出し内容と結果を記録する。
async function recordPreviewCalls(page: Page) {
	await page.addInitScript(() => {
		const calls: unknown[] = [];
		(window as unknown as { __previewCalls: unknown[] }).__previewCalls = calls;
		const original = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const res = await original(input, init);
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			if (url.endsWith('/api/og/preview') && init?.body instanceof FormData) {
				calls.push({
					variant: init.body.get('variant'),
					hasBackground: init.body.get('background') instanceof Blob,
					status: res.status,
					type: res.headers.get('content-type')
				});
			}
			return res;
		};
	});
	return () => page.evaluate(() => (window as unknown as { __previewCalls: PreviewCall[] }).__previewCalls);
}

// box/message は並列に送るので完了順は不定。variant順に並べて比較する。
function byVariant(calls: PreviewCall[]): PreviewCall[] {
	return [...calls].sort((a, b) => String(a.variant).localeCompare(String(b.variant)));
}

async function login(page: Page) {
	await page.context().addCookies([
		{ name: 'meyasuat_session', value: sessionCookieValue(), url: `http://127.0.0.1:${E2E_PORT}` }
	]);
}

test.describe('OGP設定プレビュー', () => {
	test('box/message を1枚ずつ別リクエストで生成し、背景変更後も同様に表示される', async ({ page }) => {
		await login(page);
		const previewCalls = await recordPreviewCalls(page);
		await page.goto('/dashboard/settings');

		const previews = page.locator('img[src^="blob:"]');
		const naturalWidths = () => previews.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).naturalWidth));
		await expect.poll(naturalWidths).toEqual([1200, 1200]);
		expect(byVariant(await previewCalls())).toEqual([
			{ variant: 'box', hasBackground: false, status: 200, type: 'image/png' },
			{ variant: 'message', hasBackground: false, status: 200, type: 'image/png' }
		]);

		// 背景画像を選んでクロップを確定すると、背景付きで再び box/message が別々に生成される
		await page.locator('input[type="file"]').setInputFiles('static/ogp.png');
		await page.getByRole('button', { name: 'この範囲で決定' }).click();
		await expect.poll(async () => (await previewCalls()).length).toBe(4);
		expect(byVariant((await previewCalls()).slice(2))).toEqual([
			{ variant: 'box', hasBackground: true, status: 200, type: 'image/png' },
			{ variant: 'message', hasBackground: true, status: 200, type: 'image/png' }
		]);
		// アップローダーのプレビュー(1200x630にクロップ済みの背景)＋OGPプレビュー2枚
		await expect.poll(naturalWidths).toEqual([1200, 1200, 1200]);
	});

	test('variant=both は廃止され、1枚(PNG)だけ返す', async ({ page }) => {
		await login(page);
		await page.goto('/dashboard/settings');
		const result = await page.evaluate(async () => {
			const fd = new FormData();
			fd.set('variant', 'both');
			const res = await fetch('/api/og/preview', { method: 'POST', body: fd });
			return { status: res.status, type: res.headers.get('content-type') };
		});
		expect(result).toEqual({ status: 200, type: 'image/png' });
	});
});

test.describe('OGP画像エンドポイント', () => {
	test('/api/og/u/[handle] が1200x630のPNGを返す', async ({ request }) => {
		for (let i = 0; i < 2; i++) {
			const res = await request.get(`/api/og/u/${USER_HANDLE}?v=e2e`);
			expect(res.status()).toBe(200);
			expect(res.headers()['content-type']).toBe('image/png');
			expect(res.headers()['cache-control']).toContain('max-age=86400');
			expect(pngSize(await res.body())).toEqual({ width: 1200, height: 630 });
		}
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
