import {
	AtpAgent,
	RichText,
	ChatBskyConvoGetConvoForMembers,
	ChatBskyConvoSendMessage
} from '@atproto/api';
import { getUserByDid, updateMessageBotUri } from './db.js';

const CHAT_PROXY_DID = 'did:web:api.bsky.chat';

export async function notifyCreator(
	env: App.Platform['env'],
	messageId: string,
	creatorDid: string,
	creatorHandle: string,
	creatorBoxName: string | null,
	senderDid: string | null
): Promise<void> {
	const agent = new AtpAgent({ service: 'https://bsky.social' });
	await agent.login({
		identifier: env.BOT_HANDLE,
		password: env.BOT_APP_PASSWORD
	});

	try {
		const profile = await agent.getProfile({ actor: creatorDid });
		if (!profile.data.viewer?.followedBy) return;
	} catch (e) {
		console.warn('[bot] skipped notification because follow state could not be verified', {
			creatorDid,
			error: e instanceof Error ? e.message : String(e)
		});
		return;
	}

	const appUrl = env.PUBLIC_APP_URL;
	const msgUrl = `${appUrl}/u/${creatorHandle}/m/${messageId}`;
	const boxName = creatorBoxName?.trim() || 'めやすばこ';

	const sender = senderDid ? await getUserByDid(env, senderDid) : null;
	const notice = sender
		? `${boxName}に、${sender.displayName?.trim() || sender.handle}(${sender.handle})さんからメッセージが届きました！`
		: `${boxName}にメッセージが届きました！`;
	const text = `${notice}\n${msgUrl}`;

	const rt = new RichText({ text });
	await rt.detectFacets(agent);

	const chatAgent = agent.withProxy('bsky_chat', CHAT_PROXY_DID);

	try {
		const {
			data: { convo }
		} = await chatAgent.chat.bsky.convo.getConvoForMembers({ members: [creatorDid] });

		const { data: messageView } = await chatAgent.chat.bsky.convo.sendMessage({
			convoId: convo.id,
			message: { text: rt.text, facets: rt.facets }
		});

		await updateMessageBotUri(env, messageId, `chat:${convo.id}/${messageView.id}`);
	} catch (e) {
		if (
			e instanceof ChatBskyConvoGetConvoForMembers.MessagesDisabledError ||
			e instanceof ChatBskyConvoGetConvoForMembers.NotFollowedBySenderError ||
			e instanceof ChatBskyConvoGetConvoForMembers.BlockedActorError ||
			e instanceof ChatBskyConvoGetConvoForMembers.BlockedSubjectError ||
			e instanceof ChatBskyConvoGetConvoForMembers.RecipientNotFoundError ||
			e instanceof ChatBskyConvoGetConvoForMembers.AccountSuspendedError ||
			e instanceof ChatBskyConvoSendMessage.ConvoLockedError ||
			e instanceof ChatBskyConvoSendMessage.InvalidConvoError
		) {
			console.warn('[bot] DM not deliverable', {
				messageId,
				creatorDid,
				error: e.constructor.name
			});
			return;
		}
		console.error('[bot] notifyCreator failed unexpectedly', {
			messageId,
			creatorDid,
			error: e instanceof Error ? e.message : String(e)
		});
	}
}
