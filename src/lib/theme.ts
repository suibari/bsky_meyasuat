export type OgTextSet = {
	heading: string;
	headline: string;
	muted: string;
	headerText: string;
	logoTitle: string;
	logoDomain: string;
	avatarFallbackBg: string;
	avatarFallbackFg: string;
	avatarFallbackBgAlt: string;
	avatarFallbackFgAlt: string;
};

export type OgTheme = {
	id: string;
	category: 'feminine' | 'masculine' | 'other';
	labelJa: string;
	labelEn: string;
	swatch: string;
	flat: { background: string } & OgTextSet;
	photo: { overlayColor: string; overlayOpacity: number; gradientColor: string } & OgTextSet;
};

export const DEFAULT_OG_THEME_ID = 'sky';

// 写真背景時は可読性を最優先し、全プリセット共通で白系テキスト+テーマ色の暗いスクリムに寄せる。
// 任意の写真に対しても視認性を保証するため。
const PHOTO_TEXT: OgTextSet = {
	heading: '#ffffff',
	headline: '#ffffff',
	muted: '#e2e8f0',
	headerText: '#f8fafc',
	logoTitle: '#ffffff',
	logoDomain: '#e2e8f0',
	avatarFallbackBg: 'rgba(255,255,255,0.25)',
	avatarFallbackFg: '#ffffff',
	avatarFallbackBgAlt: 'rgba(255,255,255,0.25)',
	avatarFallbackFgAlt: '#ffffff'
};

export const OG_THEMES: OgTheme[] = [
	{
		id: 'sky',
		category: 'masculine',
		labelJa: 'デフォルト',
		labelEn: 'Default',
		swatch: '#0ea5e9',
		// og.ts の従来ハードコード値と完全一致させ、未設定ユーザーの見た目を変えない
		flat: {
			background: '#ffffff',
			heading: '#0369a1',
			headline: '#0f172a',
			muted: '#64748b',
			headerText: '#475569',
			logoTitle: '#0ea5e9',
			logoDomain: '#94a3b8',
			avatarFallbackBg: '#e0f2fe',
			avatarFallbackFg: '#0284c7',
			avatarFallbackBgAlt: '#334155',
			avatarFallbackFgAlt: '#cbd5e1'
		},
		photo: { overlayColor: '#0c4a6e', overlayOpacity: 0.45, gradientColor: '#0c4a6e', ...PHOTO_TEXT }
	},
	{
		id: 'navy',
		category: 'masculine',
		labelJa: 'ネイビー',
		labelEn: 'Navy',
		swatch: '#1e3a5f',
		flat: {
			background: '#0f172a',
			heading: '#38bdf8',
			headline: '#f1f5f9',
			muted: '#94a3b8',
			headerText: '#cbd5e1',
			logoTitle: '#38bdf8',
			logoDomain: '#64748b',
			avatarFallbackBg: '#1e293b',
			avatarFallbackFg: '#7dd3fc',
			avatarFallbackBgAlt: '#1e293b',
			avatarFallbackFgAlt: '#7dd3fc'
		},
		photo: { overlayColor: '#0f172a', overlayOpacity: 0.45, gradientColor: '#0f172a', ...PHOTO_TEXT }
	},
	{
		id: 'slate',
		category: 'masculine',
		labelJa: 'スレート',
		labelEn: 'Slate',
		swatch: '#64748b',
		flat: {
			background: '#f1f5f9',
			heading: '#334155',
			headline: '#1e293b',
			muted: '#64748b',
			headerText: '#475569',
			logoTitle: '#475569',
			logoDomain: '#94a3b8',
			avatarFallbackBg: '#e2e8f0',
			avatarFallbackFg: '#334155',
			avatarFallbackBgAlt: '#cbd5e1',
			avatarFallbackFgAlt: '#334155'
		},
		photo: { overlayColor: '#334155', overlayOpacity: 0.45, gradientColor: '#334155', ...PHOTO_TEXT }
	},
	{
		id: 'pink',
		category: 'feminine',
		labelJa: 'ピンク',
		labelEn: 'Pink',
		swatch: '#ec4899',
		flat: {
			background: '#fff1f5',
			heading: '#db2777',
			headline: '#831843',
			muted: '#9d174d',
			headerText: '#be185d',
			logoTitle: '#db2777',
			logoDomain: '#f472b6',
			avatarFallbackBg: '#fce7f3',
			avatarFallbackFg: '#db2777',
			avatarFallbackBgAlt: '#fbcfe8',
			avatarFallbackFgAlt: '#9d174d'
		},
		photo: { overlayColor: '#831843', overlayOpacity: 0.45, gradientColor: '#831843', ...PHOTO_TEXT }
	},
	{
		id: 'pastel-purple',
		category: 'feminine',
		labelJa: 'パステルパープル',
		labelEn: 'Pastel Purple',
		swatch: '#a78bfa',
		flat: {
			background: '#f5f0ff',
			heading: '#8b5cf6',
			headline: '#4c1d95',
			muted: '#6d28d9',
			headerText: '#7c3aed',
			logoTitle: '#8b5cf6',
			logoDomain: '#c4b5fd',
			avatarFallbackBg: '#ede9fe',
			avatarFallbackFg: '#7c3aed',
			avatarFallbackBgAlt: '#ddd6fe',
			avatarFallbackFgAlt: '#5b21b6'
		},
		photo: { overlayColor: '#4c1d95', overlayOpacity: 0.45, gradientColor: '#4c1d95', ...PHOTO_TEXT }
	},
	{
		id: 'mint',
		category: 'feminine',
		labelJa: 'ミント',
		labelEn: 'Mint',
		swatch: '#34d399',
		flat: {
			background: '#effefa',
			heading: '#10b981',
			headline: '#065f46',
			muted: '#047857',
			headerText: '#059669',
			logoTitle: '#10b981',
			logoDomain: '#6ee7b7',
			avatarFallbackBg: '#d1fae5',
			avatarFallbackFg: '#059669',
			avatarFallbackBgAlt: '#a7f3d0',
			avatarFallbackFgAlt: '#065f46'
		},
		photo: { overlayColor: '#065f46', overlayOpacity: 0.45, gradientColor: '#065f46', ...PHOTO_TEXT }
	},
	{
		id: 'orange',
		category: 'other',
		labelJa: 'オレンジ',
		labelEn: 'Orange',
		swatch: '#f97316',
		flat: {
			background: '#fff7ed',
			heading: '#ea580c',
			headline: '#7c2d12',
			muted: '#c2410c',
			headerText: '#ea580c',
			logoTitle: '#ea580c',
			logoDomain: '#fdba74',
			avatarFallbackBg: '#ffedd5',
			avatarFallbackFg: '#c2410c',
			avatarFallbackBgAlt: '#fed7aa',
			avatarFallbackFgAlt: '#7c2d12'
		},
		photo: { overlayColor: '#7c2d12', overlayOpacity: 0.45, gradientColor: '#7c2d12', ...PHOTO_TEXT }
	},
	{
		id: 'green',
		category: 'other',
		labelJa: 'グリーン',
		labelEn: 'Green',
		swatch: '#22c55e',
		flat: {
			background: '#f0fdf4',
			heading: '#16a34a',
			headline: '#14532d',
			muted: '#15803d',
			headerText: '#16a34a',
			logoTitle: '#16a34a',
			logoDomain: '#86efac',
			avatarFallbackBg: '#dcfce7',
			avatarFallbackFg: '#15803d',
			avatarFallbackBgAlt: '#bbf7d0',
			avatarFallbackFgAlt: '#14532d'
		},
		photo: { overlayColor: '#14532d', overlayOpacity: 0.45, gradientColor: '#14532d', ...PHOTO_TEXT }
	}
];

export function getOgTheme(id: string | null | undefined): OgTheme {
	return OG_THEMES.find((t) => t.id === id) ?? OG_THEMES.find((t) => t.id === DEFAULT_OG_THEME_ID)!;
}

export function hexToRgba(hex: string, alpha: number): string {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!match) return hex;
	const int = parseInt(match[1], 16);
	const r = (int >> 16) & 255;
	const g = (int >> 8) & 255;
	const b = int & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
