export type User = {
	did: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	notifyEnabled: boolean;
	boxName: string | null;
	createdAt: string;
	updatedAt: string;
};

export type Session = {
	sessionId: string;
	userDid: string;
	expiresAt: string;
	createdAt: string;
};

export type Message = {
	id: string;
	creatorDid: string;
	body: string;
	imageKeys: string[];
	isRead: boolean;
	botPostUri: string | null;
	ipHash: string;
	createdAt: string;
};

type Env = App.Platform['env'];

function headers(env: Env): HeadersInit {
	return {
		'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
		'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
		'Content-Type': 'application/json',
		'Accept-Profile': 'meyasuat',
		'Content-Profile': 'meyasuat',
		Prefer: 'return=representation'
	};
}

function toUser(row: Record<string, unknown>): User {
	return {
		did: row.did as string,
		handle: row.handle as string,
		displayName: (row.display_name as string | null) ?? null,
		avatarUrl: (row.avatar_url as string | null) ?? null,
		notifyEnabled: row.notify_enabled as boolean,
		boxName: (row.box_name as string | null) ?? null,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	};
}

function toMessage(row: Record<string, unknown>): Message {
	return {
		id: row.id as string,
		creatorDid: row.creator_did as string,
		body: row.body as string,
		imageKeys: (row.image_keys as string[] | null) ?? [],
		isRead: row.is_read as boolean,
		botPostUri: (row.bot_post_uri as string | null) ?? null,
		ipHash: row.ip_hash as string,
		createdAt: row.created_at as string
	};
}

export async function getUserByDid(env: Env, did: string): Promise<User | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/users?did=eq.${encodeURIComponent(did)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserByHandle(env: Env, handle: string): Promise<User | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/users?handle=eq.${encodeURIComponent(handle)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	return rows[0] ? toUser(rows[0]) : null;
}

export async function upsertUser(env: Env, user: Pick<User, 'did' | 'handle'> & Partial<User>): Promise<User> {
	const body = {
		did: user.did,
		handle: user.handle,
		display_name: user.displayName ?? null,
		avatar_url: user.avatarUrl ?? null,
		notify_enabled: user.notifyEnabled ?? false,
		updated_at: new Date().toISOString()
	};
	const res = await fetch(`${env.POSTGREST_URL}/users`, {
		method: 'POST',
		headers: {
			...headers(env),
			Prefer: 'return=representation,resolution=merge-duplicates'
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`upsertUser failed: ${await res.text()}`);
	const rows = await res.json() as Record<string, unknown>[];
	return toUser(rows[0]);
}

export async function updateUser(env: Env, did: string, patch: Partial<Pick<User, 'handle' | 'displayName' | 'avatarUrl' | 'notifyEnabled' | 'boxName'>>): Promise<void> {
	const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (patch.handle !== undefined) body.handle = patch.handle;
	if (patch.displayName !== undefined) body.display_name = patch.displayName;
	if (patch.avatarUrl !== undefined) body.avatar_url = patch.avatarUrl;
	if (patch.notifyEnabled !== undefined) body.notify_enabled = patch.notifyEnabled;
	if (patch.boxName !== undefined) body.box_name = patch.boxName;
	await fetch(
		`${env.POSTGREST_URL}/users?did=eq.${encodeURIComponent(did)}`,
		{ method: 'PATCH', headers: headers(env), body: JSON.stringify(body) }
	);
}

export async function createSession(env: Env, userDid: string): Promise<Session> {
	const res = await fetch(`${env.POSTGREST_URL}/sessions`, {
		method: 'POST',
		headers: headers(env),
		body: JSON.stringify({ user_did: userDid })
	});
	if (!res.ok) throw new Error(`createSession failed: ${await res.text()}`);
	const rows = await res.json() as Record<string, unknown>[];
	const row = rows[0];
	return {
		sessionId: row.session_id as string,
		userDid: row.user_did as string,
		expiresAt: row.expires_at as string,
		createdAt: row.created_at as string
	};
}

export async function getSession(env: Env, sessionId: string): Promise<Session | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/sessions?session_id=eq.${encodeURIComponent(sessionId)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	if (!rows[0]) return null;
	const row = rows[0];
	return {
		sessionId: row.session_id as string,
		userDid: row.user_did as string,
		expiresAt: row.expires_at as string,
		createdAt: row.created_at as string
	};
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
	await fetch(
		`${env.POSTGREST_URL}/sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
		{ method: 'DELETE', headers: headers(env) }
	);
}

export async function createMessage(
	env: Env,
	data: { creatorDid: string; body: string; imageKeys: string[]; ipHash: string }
): Promise<Message> {
	const body = {
		creator_did: data.creatorDid,
		body: data.body,
		image_keys: data.imageKeys,
		ip_hash: data.ipHash
	};
	const res = await fetch(`${env.POSTGREST_URL}/messages`, {
		method: 'POST',
		headers: headers(env),
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`createMessage failed: ${await res.text()}`);
	const rows = await res.json() as Record<string, unknown>[];
	return toMessage(rows[0]);
}

export async function getMessages(
	env: Env,
	creatorDid: string,
	opts: { limit?: number; offset?: number; unreadOnly?: boolean; readOnly?: boolean } = {}
): Promise<Message[]> {
	const { limit = 20, offset = 0, unreadOnly = false, readOnly = false } = opts;
	let url = `${env.POSTGREST_URL}/messages?creator_did=eq.${encodeURIComponent(creatorDid)}&order=created_at.desc&limit=${limit}&offset=${offset}`;
	if (unreadOnly) url += '&is_read=eq.false';
	if (readOnly) url += '&is_read=eq.true';
	const res = await fetch(url, { headers: headers(env) });
	if (!res.ok) return [];
	const rows = await res.json() as Record<string, unknown>[];
	return rows.map(toMessage);
}

export async function getMessageById(env: Env, id: string): Promise<Message | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	return rows[0] ? toMessage(rows[0]) : null;
}

export async function markMessageRead(env: Env, id: string, creatorDid: string): Promise<void> {
	await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&creator_did=eq.${encodeURIComponent(creatorDid)}`,
		{ method: 'PATCH', headers: headers(env), body: JSON.stringify({ is_read: true }) }
	);
}

export async function markMessageUnread(env: Env, id: string, creatorDid: string): Promise<void> {
	await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&creator_did=eq.${encodeURIComponent(creatorDid)}`,
		{ method: 'PATCH', headers: headers(env), body: JSON.stringify({ is_read: false }) }
	);
}

export async function deleteMessage(env: Env, id: string, creatorDid: string): Promise<void> {
	await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&creator_did=eq.${encodeURIComponent(creatorDid)}`,
		{ method: 'DELETE', headers: headers(env) }
	);
}

export async function updateMessageBotUri(env: Env, id: string, botPostUri: string): Promise<void> {
	await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}`,
		{ method: 'PATCH', headers: headers(env), body: JSON.stringify({ bot_post_uri: botPostUri }) }
	);
}

export async function countUnread(env: Env, creatorDid: string): Promise<number> {
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?creator_did=eq.${encodeURIComponent(creatorDid)}&is_read=eq.false&select=id`,
		{
			headers: { ...headers(env), Prefer: 'count=exact' }
		}
	);
	const count = res.headers.get('Content-Range')?.split('/')[1];
	return count ? parseInt(count, 10) : 0;
}

export async function checkRateLimit(
	env: Env,
	ipHash: string,
	creatorDid: string,
	windowMs: number,
	maxCount: number
): Promise<boolean> {
	const since = new Date(Date.now() - windowMs).toISOString();
	const res = await fetch(
		`${env.POSTGREST_URL}/rate_limit_log?ip_hash=eq.${encodeURIComponent(ipHash)}&creator_did=eq.${encodeURIComponent(creatorDid)}&created_at=gt.${encodeURIComponent(since)}&select=id`,
		{
			headers: { ...headers(env), Prefer: 'count=exact' }
		}
	);
	const count = res.headers.get('Content-Range')?.split('/')[1];
	return !count || parseInt(count, 10) < maxCount;
}

export async function logRateLimit(env: Env, ipHash: string, creatorDid: string): Promise<void> {
	await fetch(`${env.POSTGREST_URL}/rate_limit_log`, {
		method: 'POST',
		headers: { ...headers(env), Prefer: 'return=minimal' },
		body: JSON.stringify({ ip_hash: ipHash, creator_did: creatorDid })
	});
}
