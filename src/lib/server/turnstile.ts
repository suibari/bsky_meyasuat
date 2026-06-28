export async function verifyTurnstile(
	secretKey: string,
	token: string,
	remoteip?: string
): Promise<boolean> {
	const body = new URLSearchParams({ secret: secretKey, response: token });
	if (remoteip) body.set('remoteip', remoteip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});
	if (!res.ok) return false;
	const data = await res.json() as { success: boolean };
	return data.success;
}
