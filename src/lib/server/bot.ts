import { AtpAgent, RichText } from '@atproto/api';
import { getUserByDid, updateMessageBotUri } from './db.js';

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

	const appUrl = env.PUBLIC_APP_URL;
	const msgUrl = `${appUrl}/u/${creatorHandle}/m/${messageId}`;
	const boxName = creatorBoxName?.trim() || 'めやすばこ';

	const sender = senderDid ? await getUserByDid(env, senderDid) : null;
	// ハンドルに @ を付けるとメンションとして検出され送信者に通知が飛ぶため、付けない
	const notice = sender
		? `${boxName}に、${sender.displayName?.trim() || sender.handle}(${sender.handle})さんからメッセージが届きました！`
		: `${boxName}にメッセージが届きました！`;
	const text = `@${creatorHandle} ${notice}\n${msgUrl}`;

	const rt = new RichText({ text });
	await rt.detectFacets(agent);

	const result = await agent.post({
		text: rt.text,
		facets: rt.facets,
		langs: ['ja', 'en']
	});

	await updateMessageBotUri(env, messageId, result.uri);
}
