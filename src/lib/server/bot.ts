import { AtpAgent, RichText } from '@atproto/api';
import { updateMessageBotUri } from './db.js';

export async function notifyCreator(
	env: App.Platform['env'],
	messageId: string,
	creatorDid: string,
	creatorHandle: string
): Promise<void> {
	const agent = new AtpAgent({ service: 'https://bsky.social' });
	await agent.login({
		identifier: env.BOT_HANDLE,
		password: env.BOT_APP_PASSWORD
	});

	const appUrl = env.PUBLIC_APP_URL;
	const msgUrl = `${appUrl}/u/${creatorHandle}/m/${messageId}`;
	const text = `@${creatorHandle} めやすあっとが届きました！\n${msgUrl}`;

	const rt = new RichText({ text });
	await rt.detectFacets(agent);

	const result = await agent.post({
		text: rt.text,
		facets: rt.facets,
		langs: ['ja', 'en']
	});

	await updateMessageBotUri(env, messageId, result.uri);
}
