import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkModeration } from '$lib/server/moderation.js';

function mockFetchOnce(response: { ok: boolean; status?: number; body?: unknown }) {
	return vi.fn().mockResolvedValue({
		ok: response.ok,
		status: response.status ?? (response.ok ? 200 : 500),
		json: async () => response.body
	});
}

describe('checkModeration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('flags text that violates a blocked category', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetchOnce({
				ok: true,
				body: { results: [{ flagged: true, categories: { harassment: true }, category_scores: {} }] }
			})
		);
		const result = await checkModeration('key', 'bad text', []);
		expect(result).toBe(true);
	});

	it('flags when any result in a multi-part response is flagged', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetchOnce({
				ok: true,
				body: {
					results: [
						{ flagged: false, categories: { harassment: false }, category_scores: {} },
						{ flagged: true, categories: { violence: true }, category_scores: {} }
					]
				}
			})
		);
		const result = await checkModeration('key', 'text', [{ buf: new ArrayBuffer(4), contentType: 'image/png' }]);
		expect(result).toBe(true);
	});

	it('does not flag self-harm category by default', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetchOnce({
				ok: true,
				body: {
					results: [
						{
							flagged: true,
							categories: { 'self-harm': true, 'self-harm/intent': true, harassment: false },
							category_scores: {}
						}
					]
				}
			})
		);
		const result = await checkModeration('key', 'text', []);
		expect(result).toBe(false);
	});

	it('returns false for clean content', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetchOnce({
				ok: true,
				body: { results: [{ flagged: false, categories: { harassment: false }, category_scores: {} }] }
			})
		);
		const result = await checkModeration('key', 'hello', []);
		expect(result).toBe(false);
	});

	it('fails open on non-200 response', async () => {
		vi.stubGlobal('fetch', mockFetchOnce({ ok: false, status: 500 }));
		const result = await checkModeration('key', 'text', []);
		expect(result).toBe(false);
	});

	it('fails open on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
		const result = await checkModeration('key', 'text', []);
		expect(result).toBe(false);
	});

	it('does not call fetch for empty input', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const result = await checkModeration('key', '', []);
		expect(result).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
