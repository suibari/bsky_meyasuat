export const MEYASUAT_OAUTH_SCOPE = [
	'atproto',
	'rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview',
	'repo:app.bsky.graph.follow?action=create',
	'repo:com.suibari.meyasuat.question?action=create',
	'repo:com.suibari.meyasuat.question?action=delete',
	'repo:com.suibari.meyasuat.answer?action=create',
	'repo:com.suibari.meyasuat.answer?action=delete',
	'blob:image/*'
].join(' ');
