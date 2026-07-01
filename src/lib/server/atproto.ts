export async function resolveHandle(handle: string): Promise<{ did: string } | null> {
	try {
		const res = await fetch(
			`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
		);
		if (!res.ok) return null;
		return await res.json() as { did: string };
	} catch {
		return null;
	}
}

export async function getHandleFromDid(did: string): Promise<string | null> {
	try {
		const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
		if (!res.ok) return null;
		const doc = await res.json() as { alsoKnownAs?: string[] };
		const atUri = doc.alsoKnownAs?.find((u) => u.startsWith('at://'));
		return atUri ? atUri.replace('at://', '') : null;
	} catch {
		return null;
	}
}

export async function getProfileFromAccessToken(
	accessToken: string
): Promise<{ did: string; handle: string; displayName?: string; avatar?: string } | null> {
	try {
		const res = await fetch('https://bsky.social/xrpc/com.atproto.server.getSession', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (!res.ok) return null;
		const data = await res.json() as {
			did: string;
			handle: string;
			email?: string;
		};
		// fetch profile for display_name and avatar
		const profileRes = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(data.did)}`
		);
		if (profileRes.ok) {
			const profile = await profileRes.json() as {
				displayName?: string;
				avatar?: string;
			};
			return {
				did: data.did,
				handle: data.handle,
				displayName: profile.displayName,
				avatar: profile.avatar
			};
		}
		return { did: data.did, handle: data.handle };
	} catch {
		return null;
	}
}

export async function syncUserHandle(
	env: App.Platform['env'],
	did: string
): Promise<void> {
	const { updateUser } = await import('./db.js');
	const handle = await getHandleFromDid(did);
	if (handle) {
		await updateUser(env, did, { handle });
	}
}

type ParsedAtUri = {
	repo: string;
	collection: string;
	rkey: string;
};

export function parseAtUri(uri: string): ParsedAtUri | null {
	if (!uri.startsWith('at://')) return null;
	const parts = uri.slice('at://'.length).split('/');
	if (parts.length < 3) return null;
	const [repo, collection, rkey] = parts;
	if (!repo || !collection || !rkey) return null;
	return { repo, collection, rkey };
}

export type PdsRecordLookupResult = {
	found: boolean;
	notFound: boolean;
	cid?: string;
	value?: Record<string, unknown>;
};

export type PdsListedRecord = {
	uri: string;
	cid: string;
	value: Record<string, unknown>;
};

export async function getRecordByAtUri(uri: string): Promise<PdsRecordLookupResult> {
	const parsed = parseAtUri(uri);
	if (!parsed) {
		return { found: false, notFound: true };
	}

	const query = new URLSearchParams({
		repo: parsed.repo,
		collection: parsed.collection,
		rkey: parsed.rkey
	});

	const res = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?${query.toString()}`);

	if (res.ok) {
		const data = await res.json() as { cid?: string; value?: Record<string, unknown> };
		return {
			found: true,
			notFound: false,
			cid: data.cid,
			value: data.value
		};
	}

	if (res.status === 404 || res.status === 400) {
		const body = await res.json().catch(() => null) as { error?: string } | null;
		if (!body || body.error === 'RecordNotFound' || body.error === 'RepoNotFound') {
			return { found: false, notFound: true };
		}
	}

	throw new Error(`getRecordByAtUri failed: ${res.status}`);
}

export async function listRecordsByRepo(
	repoDid: string,
	collection: string,
	limit = 50
): Promise<PdsListedRecord[]> {
	const query = new URLSearchParams({
		repo: repoDid,
		collection,
		limit: String(limit)
	});
	const res = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?${query.toString()}`);
	if (!res.ok) {
		throw new Error(`listRecordsByRepo failed: ${res.status}`);
	}
	const data = await res.json() as { records?: Array<{ uri: string; cid: string; value: Record<string, unknown> }> };
	return (data.records ?? []).filter((r) => !!r.uri && !!r.cid && !!r.value);
}
