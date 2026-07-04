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
		swatch: '#2563eb',
		flat: {
			background: '#eff6ff',
			heading: '#1d4ed8',
			headline: '#172554',
			muted: '#1e40af',
			headerText: '#2563eb',
			logoTitle: '#2563eb',
			logoDomain: '#93c5fd',
			avatarFallbackBg: '#dbeafe',
			avatarFallbackFg: '#1d4ed8',
			avatarFallbackBgAlt: '#bfdbfe',
			avatarFallbackFgAlt: '#1e3a8a'
		},
		photo: { overlayColor: '#172554', overlayOpacity: 0.45, gradientColor: '#172554', ...PHOTO_TEXT }
	},
	{
		id: 'slate',
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
		swatch: '#e11d48',
		flat: {
			background: '#fff1f2',
			heading: '#e11d48',
			headline: '#881337',
			muted: '#be123c',
			headerText: '#e11d48',
			logoTitle: '#e11d48',
			logoDomain: '#fb7185',
			avatarFallbackBg: '#ffe4e6',
			avatarFallbackFg: '#e11d48',
			avatarFallbackBgAlt: '#fecdd3',
			avatarFallbackFgAlt: '#9f1239'
		},
		photo: { overlayColor: '#881337', overlayOpacity: 0.45, gradientColor: '#881337', ...PHOTO_TEXT }
	},
	{
		id: 'pastel-purple',
		swatch: '#8b5cf6',
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
		swatch: '#14b8a6',
		flat: {
			background: '#f0fdfa',
			heading: '#0d9488',
			headline: '#134e4a',
			muted: '#0f766e',
			headerText: '#0d9488',
			logoTitle: '#0d9488',
			logoDomain: '#5eead4',
			avatarFallbackBg: '#ccfbf1',
			avatarFallbackFg: '#0f766e',
			avatarFallbackBgAlt: '#99f6e4',
			avatarFallbackFgAlt: '#134e4a'
		},
		photo: { overlayColor: '#134e4a', overlayOpacity: 0.45, gradientColor: '#134e4a', ...PHOTO_TEXT }
	},
	{
		id: 'orange',
		swatch: '#f59e0b',
		flat: {
			background: '#fffbeb',
			heading: '#d97706',
			headline: '#78350f',
			muted: '#b45309',
			headerText: '#d97706',
			logoTitle: '#d97706',
			logoDomain: '#fbbf24',
			avatarFallbackBg: '#fef3c7',
			avatarFallbackFg: '#b45309',
			avatarFallbackBgAlt: '#fde68a',
			avatarFallbackFgAlt: '#78350f'
		},
		photo: { overlayColor: '#78350f', overlayOpacity: 0.45, gradientColor: '#78350f', ...PHOTO_TEXT }
	},
	{
		id: 'green',
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
