import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getProfile: vi.fn(),
	post: vi.fn(),
	login: vi.fn(),
	detectFacets: vi.fn(),
	getUserByDid: vi.fn(),
	updateMessageBotUri: vi.fn()
}));

vi.mock('@atproto/api', () => ({
	AtpAgent: vi.fn().mockImplementation(function () {
		return {
			login: mocks.login,
			getProfile: mocks.getProfile,
			post: mocks.post
		};
	}),
	RichText: vi.fn().mockImplementation(function (
		this: { text: string; facets?: unknown[]; detectFacets?: typeof mocks.detectFacets },
		opts: { text: string }
	) {
		this.text = opts.text;
		this.facets = [];
		this.detectFacets = mocks.detectFacets;
	})
}));

vi.mock('$lib/server/db.js', () => ({
	getUserByDid: mocks.getUserByDid,
	updateMessageBotUri: mocks.updateMessageBotUri
}));

import { notifyCreator } from '$lib/server/bot.js';

const env = {
	BOT_HANDLE: 'bot.example.com',
	BOT_APP_PASSWORD: 'app-password',
	PUBLIC_APP_URL: 'https://meyasuat.example'
} as App.Platform['env'];

describe('notifyCreator', () => {
	beforeEach(() => {
		mocks.login.mockResolvedValue(undefined);
		mocks.getProfile.mockResolvedValue({ data: { viewer: { followedBy: 'at://creator/follow/bot' } } });
		mocks.post.mockResolvedValue({ uri: 'at://bot/app.bsky.feed.post/notice' });
		mocks.detectFacets.mockResolvedValue(undefined);
		mocks.getUserByDid.mockResolvedValue(null);
		mocks.updateMessageBotUri.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('posts a mention when the creator follows the bot', async () => {
		await notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null);

		expect(mocks.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:creator' });
		expect(mocks.post).toHaveBeenCalledWith({
			text: '@alice.example.com めやすばこにメッセージが届きました！\nhttps://meyasuat.example/u/alice.example.com/m/message-1',
			facets: [],
			langs: ['ja', 'en']
		});
		expect(mocks.updateMessageBotUri).toHaveBeenCalledWith(
			env,
			'message-1',
			'at://bot/app.bsky.feed.post/notice'
		);
	});

	it('does not post when the creator no longer follows the bot', async () => {
		mocks.getProfile.mockResolvedValue({ data: { viewer: {} } });

		await notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null);

		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.updateMessageBotUri).not.toHaveBeenCalled();
	});

	it('does not post when the follow state cannot be verified', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.getProfile.mockRejectedValue(new Error('profile unavailable'));

		await expect(
			notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null)
		).resolves.toBeUndefined();

		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.updateMessageBotUri).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith(
			'[bot] skipped notification because follow state could not be verified',
			{ creatorDid: 'did:plc:creator', error: 'profile unavailable' }
		);
	});
});
