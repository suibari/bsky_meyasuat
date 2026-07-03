export interface ModerationImage {
	buf: ArrayBuffer;
	contentType: string;
}

interface ModerationResultItem {
	flagged: boolean;
	categories: Record<string, boolean>;
	category_scores: Record<string, number>;
}

// omni-moderation-latest の全13カテゴリのうち、フラグが立ったら送信を拒否する対象。
// 増減させたい場合はこの Set を編集するだけでよい(コード変更はここだけで完結する)。
const BLOCKED_CATEGORIES = new Set([
	'harassment', // 嫌がらせ全般
	'harassment/threatening', // 脅迫を伴う嫌がらせ
	'hate', // 差別・憎悪表現
	'hate/threatening', // 脅迫を伴う差別・憎悪表現
	'illicit', // 違法行為の助長
	'illicit/violent', // 暴力を伴う違法行為の助長
	'sexual', // 性的表現
	'sexual/minors', // 未成年に対する性的表現 (常時有効を推奨、外さないこと)
	'violence', // 暴力表現
	'violence/graphic' // 生々しい暴力描写
	// 'self-harm', 'self-harm/intent', 'self-harm/instructions' は意図的に除外。
	// 理由: 匿名質問箱では自傷/希死念慮についての「助けを求めるメッセージ」が
	// ここに引っかかりうるため、一律拒否にはしない。
	// 拒否ではなく相談窓口を案内する等の対応を追加したい場合は、
	// checkModeration の内部で見ている categories を呼び出し元に返す形に変更し、
	// 別分岐を実装すること。
]);

export async function checkModeration(
	apiKey: string,
	body: string,
	images: ModerationImage[]
): Promise<boolean> {
	// true = ブロックすべき(BLOCKED_CATEGORIESのいずれかにヒット)。fail-open時は false を返す。
	try {
		const input: Array<
			| { type: 'text'; text: string }
			| { type: 'image_url'; image_url: { url: string } }
		> = [];
		if (body) input.push({ type: 'text', text: body });
		for (const img of images) {
			const bytes = new Uint8Array(img.buf);
			let binary = '';
			for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
			input.push({ type: 'image_url', image_url: { url: `data:${img.contentType};base64,${btoa(binary)}` } });
		}
		if (input.length === 0) return false;

		const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
		const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
		try {
			const res = await fetch('https://api.openai.com/v1/moderations', {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: 'omni-moderation-latest', input }),
				signal: controller?.signal
			});
			if (!res.ok) {
				console.error('[moderation] non-200 response', res.status);
				return false;
			}
			const data = (await res.json()) as { results: ModerationResultItem[] };
			// カテゴリごとのしきい値調整をしたい場合は、ここで category_scores[cat] と
			// 独自の閾値を比較するロジックに差し替えられる(現状はOpenAI側のbool判定をそのまま使用)。
			return data.results.some((r) =>
				Object.entries(r.categories).some(([cat, hit]) => hit && BLOCKED_CATEGORIES.has(cat))
			);
		} finally {
			if (timeoutId !== null) clearTimeout(timeoutId);
		}
	} catch (e) {
		console.error('[moderation] request failed, failing open', e);
		return false;
	}
}
