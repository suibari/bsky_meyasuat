import { getRecordByAtUri, parseAtUri } from './atproto.js';

export type User = {
	did: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	notifyEnabled: boolean;
	shareHandleEnabled: boolean;
	requireNamedEnabled: boolean;
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
	createdAt: string;
	answer: string | null;
	answeredAt: string | null;
	senderDid: string | null;
	questionRecordUri: string | null;
	answerRecordUri: string | null;
};

type Env = App.Platform['env'];

export class PostgrestError extends Error {
	code?: string;
	constructor(message: string, code?: string) {
		super(message);
		this.code = code;
	}
}

async function throwPostgrestError(res: Response, action: string): Promise<never> {
	const text = await res.text();
	let code: string | undefined;
	try {
		code = (JSON.parse(text) as { code?: string }).code;
	} catch {
		// レスポンスがJSONでない場合は code なしで投げる
	}
	throw new PostgrestError(`${action} failed: ${text}`, code);
}

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
		notifyEnabled: row.notify_enabled === true,
		shareHandleEnabled: row.share_handle_enabled === true,
		requireNamedEnabled: row.require_named_enabled === true,
		boxName: typeof row.box_name === 'string' ? row.box_name : null,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	};
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function readNullableString(value: unknown, fallback: string | null): string | null {
	return typeof value === 'string' ? value : fallback;
}

async function getConfigByDid(
	did: string,
	fallback: Pick<User, 'notifyEnabled' | 'shareHandleEnabled' | 'requireNamedEnabled' | 'boxName'>
): Promise<Pick<User, 'notifyEnabled' | 'shareHandleEnabled' | 'requireNamedEnabled' | 'boxName'>> {
	try {
		const record = await getRecordByAtUri(`at://${did}/com.suibari.meyasuat.config/self`);
		if (!record.found || !record.value) return fallback;
		return {
			notifyEnabled: readBoolean(record.value.notifyEnabled, fallback.notifyEnabled),
			shareHandleEnabled: readBoolean(record.value.shareHandleEnabled, fallback.shareHandleEnabled),
			requireNamedEnabled: readBoolean(record.value.requireNamedEnabled, fallback.requireNamedEnabled),
			boxName: readNullableString(record.value.boxName, fallback.boxName)
		};
	} catch {
		return fallback;
	}
}

async function withPdsConfig(user: User): Promise<User> {
	const config = await getConfigByDid(user.did, {
		notifyEnabled: user.notifyEnabled,
		shareHandleEnabled: user.shareHandleEnabled,
		requireNamedEnabled: user.requireNamedEnabled,
		boxName: user.boxName
	});
	return { ...user, ...config };
}

function toMessage(row: Record<string, unknown>): Message {
	return {
		id: row.id as string,
		creatorDid: row.creator_did as string,
		body: row.body as string,
		imageKeys: (row.image_keys as string[] | null) ?? [],
		isRead: row.is_read as boolean,
		createdAt: row.created_at as string,
		answer: null,
		answeredAt: null,
		senderDid: typeof row.question_record_uri === 'string' ? parseAtUri(row.question_record_uri)?.repo ?? null : null,
		questionRecordUri: (row.question_record_uri as string | null) ?? null,
		answerRecordUri: (row.answer_record_uri as string | null) ?? null
	};
}

export async function getUserByDid(env: Env, did: string): Promise<User | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/users?did=eq.${encodeURIComponent(did)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	return rows[0] ? withPdsConfig(toUser(rows[0])) : null;
}

export async function getUserByHandle(env: Env, handle: string): Promise<User | null> {
	const res = await fetch(
		`${env.POSTGREST_URL}/users?handle=eq.${encodeURIComponent(handle)}&limit=1`,
		{ headers: headers(env) }
	);
	if (!res.ok) return null;
	const rows = await res.json() as Record<string, unknown>[];
	return rows[0] ? withPdsConfig(toUser(rows[0])) : null;
}

export async function upsertUser(env: Env, user: Pick<User, 'did' | 'handle'> & Partial<User>): Promise<User> {
	const body = {
		did: user.did,
		handle: user.handle,
		display_name: user.displayName ?? null,
		avatar_url: user.avatarUrl ?? null,
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
	return withPdsConfig(toUser(rows[0]));
}

export async function updateUser(env: Env, did: string, patch: Partial<Pick<User, 'handle' | 'displayName' | 'avatarUrl'>>): Promise<void> {
	const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (patch.handle !== undefined) body.handle = patch.handle;
	if (patch.displayName !== undefined) body.display_name = patch.displayName;
	if (patch.avatarUrl !== undefined) body.avatar_url = patch.avatarUrl;
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
	data: { creatorDid: string; body: string; imageKeys: string[] }
): Promise<Message> {
	const body = {
		creator_did: data.creatorDid,
		body: data.body,
		image_keys: data.imageKeys
	};
	const res = await fetch(`${env.POSTGREST_URL}/messages`, {
		method: 'POST',
		headers: headers(env),
		body: JSON.stringify(body)
	});
	if (!res.ok) await throwPostgrestError(res, 'createMessage');
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
	if (unreadOnly) url += '&is_read=eq.false&answer_record_uri=is.null';
	if (readOnly) url += '&is_read=eq.true&answer_record_uri=is.null';
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

export async function answerMessage(env: Env, id: string, creatorDid: string, answer: string): Promise<void> {
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&creator_did=eq.${encodeURIComponent(creatorDid)}&select=id`,
		{
			headers: headers(env)
		}
	);
	if (!res.ok) await throwPostgrestError(res, 'answerMessage');
}

export async function updateMessageBotUri(env: Env, id: string, botPostUri: string): Promise<void> {
	void env;
	void id;
	void botPostUri;
}

export async function updateMessageQuestionRef(
	env: Env,
	id: string,
	uri: string
): Promise<boolean> {
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}`,
		{
			method: 'PATCH',
			headers: { ...headers(env), Prefer: 'return=representation' },
			body: JSON.stringify({ question_record_uri: uri, body: '' })
		}
	);
	if (!res.ok) return false;
	const rows = await res.json() as unknown[];
	return rows.length > 0;
}

export async function deleteQuestionForSender(env: Env, id: string, senderDid: string): Promise<boolean> {
	void senderDid;
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?id=eq.${encodeURIComponent(id)}&select=id`,
		{
			headers: headers(env)
		}
	);
	if (!res.ok) return false;
	const rows = await res.json() as unknown[];
	return rows.length > 0;
}

export async function getCreatorImageKeys(env: Env, creatorDid: string): Promise<string[]> {
	const res = await fetch(
		`${env.POSTGREST_URL}/messages?creator_did=eq.${encodeURIComponent(creatorDid)}&select=image_keys`,
		{ headers: headers(env) }
	);
	if (!res.ok) return [];
	const rows = await res.json() as { image_keys: string[] | null }[];
	return rows.flatMap((row) => row.image_keys ?? []);
}

// 箱本体(users)と、それに紐づくデータを全削除する。creator_did=自分 のメッセージ、
// rate_limit_log、sessions、users の順に子から親へ削除する。
// R2画像削除は呼び出し側(エンドポイント)で事前に処理する。
export async function deleteBoxAndRelatedData(env: Env, did: string): Promise<void> {
	const deletes: [string, string][] = [
		[`messages?creator_did=eq.${encodeURIComponent(did)}`, 'deleteBoxMessages'],
		[`rate_limit_log?creator_did=eq.${encodeURIComponent(did)}`, 'deleteBoxRateLimitLog'],
		[`sessions?user_did=eq.${encodeURIComponent(did)}`, 'deleteBoxSessions'],
		[`users?did=eq.${encodeURIComponent(did)}`, 'deleteBoxUser']
	];
	for (const [query, action] of deletes) {
		const res = await fetch(`${env.POSTGREST_URL}/${query}`, {
			method: 'DELETE',
			headers: { ...headers(env), Prefer: 'return=minimal' }
		});
		if (!res.ok) await throwPostgrestError(res, action);
	}
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
