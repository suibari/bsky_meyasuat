export function ogImageUrl(appUrl: string, handle: string, messageId: string, ogVersion?: string): string {
	const base = `${appUrl}/api/og/u/${handle}/m/${messageId}`;
	return ogVersion ? `${base}?v=${ogVersion}` : base;
}

export function pageShareUrl(appUrl: string, handle: string, messageId: string): string {
	return `${appUrl}/u/${handle}/m/${messageId}`;
}

export function blueskyShareUrl(url: string): string {
	return `https://bsky.app/intent/compose?text=${encodeURIComponent(url)}`;
}

export function xShareUrl(url: string): string {
	return `https://twitter.com/intent/tweet?text=${encodeURIComponent(url)}`;
}
