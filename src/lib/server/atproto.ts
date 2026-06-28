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
