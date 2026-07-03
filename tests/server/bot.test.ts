import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getProfile: vi.fn(),
	login: vi.fn(),
	withProxy: vi.fn(),
	getConvoForMembers: vi.fn(),
	sendMessage: vi.fn(),
	detectFacets: vi.fn(),
	getUserByDid: vi.fn(),
	updateMessageBotUri: vi.fn()
}));

vi.mock('@atproto/api', () => {
	class MessagesDisabledError extends Error {}
	class NotFollowedBySenderError extends Error {}
	class BlockedActorError extends Error {}
	class BlockedSubjectError extends Error {}
	class RecipientNotFoundError extends Error {}
	class AccountSuspendedError extends Error {}
	class ConvoLockedError extends Error {}
	class InvalidConvoError extends Error {}

	return {
		AtpAgent: vi.fn().mockImplementation(function () {
			return {
				login: mocks.login,
				getProfile: mocks.getProfile,
				withProxy: mocks.withProxy
			};
		}),
		RichText: vi.fn().mockImplementation(function (
			this: { text: string; facets?: unknown[]; detectFacets?: typeof mocks.detectFacets },
			opts: { text: string }
		) {
			this.text = opts.text;
			this.facets = [];
			this.detectFacets = mocks.detectFacets;
		}),
		ChatBskyConvoGetConvoForMembers: {
			MessagesDisabledError,
			NotFollowedBySenderError,
			BlockedActorError,
			BlockedSubjectError,
			RecipientNotFoundError,
			AccountSuspendedError
		},
		ChatBskyConvoSendMessage: {
			ConvoLockedError,
			InvalidConvoError
		}
	};
});

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
		mocks.withProxy.mockReturnValue({
			chat: { bsky: { convo: { getConvoForMembers: mocks.getConvoForMembers, sendMessage: mocks.sendMessage } } }
		});
		mocks.getConvoForMembers.mockResolvedValue({ data: { convo: { id: 'convo-1' } } });
		mocks.sendMessage.mockResolvedValue({ data: { id: 'msg-1' } });
		mocks.detectFacets.mockResolvedValue(undefined);
		mocks.getUserByDid.mockResolvedValue(null);
		mocks.updateMessageBotUri.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('sends a DM when the creator follows the bot', async () => {
		await notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null);

		expect(mocks.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:creator' });
		expect(mocks.withProxy).toHaveBeenCalledWith('bsky_chat', 'did:web:api.bsky.chat');
		expect(mocks.getConvoForMembers).toHaveBeenCalledWith({ members: ['did:plc:creator'] });
		expect(mocks.sendMessage).toHaveBeenCalledWith({
			convoId: 'convo-1',
			message: {
				text: 'めやすばこにメッセージが届きました！\nhttps://meyasuat.example/u/alice.example.com/m/message-1',
				facets: []
			}
		});
		expect(mocks.updateMessageBotUri).toHaveBeenCalledWith(env, 'message-1', 'chat:convo-1/msg-1');
	});

	it('does not send a DM when the creator no longer follows the bot', async () => {
		mocks.getProfile.mockResolvedValue({ data: { viewer: {} } });

		await notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null);

		expect(mocks.getConvoForMembers).not.toHaveBeenCalled();
		expect(mocks.sendMessage).not.toHaveBeenCalled();
		expect(mocks.updateMessageBotUri).not.toHaveBeenCalled();
	});

	it('does not send a DM when the follow state cannot be verified', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.getProfile.mockRejectedValue(new Error('profile unavailable'));

		await expect(
			notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null)
		).resolves.toBeUndefined();

		expect(mocks.getConvoForMembers).not.toHaveBeenCalled();
		expect(mocks.updateMessageBotUri).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith(
			'[bot] skipped notification because follow state could not be verified',
			{ creatorDid: 'did:plc:creator', error: 'profile unavailable' }
		);
	});

	it('logs a warning and does not throw when the DM is not deliverable', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { ChatBskyConvoGetConvoForMembers } = await import('@atproto/api');
		mocks.getConvoForMembers.mockRejectedValue(
			new ChatBskyConvoGetConvoForMembers.MessagesDisabledError('DM disabled')
		);

		await expect(
			notifyCreator(env, 'message-1', 'did:plc:creator', 'alice.example.com', null, null)
		).resolves.toBeUndefined();

		expect(mocks.sendMessage).not.toHaveBeenCalled();
		expect(mocks.updateMessageBotUri).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith('[bot] DM not deliverable', {
			messageId: 'message-1',
			creatorDid: 'did:plc:creator',
			error: 'MessagesDisabledError'
		});
	});
});
