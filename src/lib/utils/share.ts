export function ogImageUrl(appUrl: string, messageId: string): string {
	return `${appUrl}/api/og/${messageId}`;
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
