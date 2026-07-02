// 本番のOGPカード生成ロジック(src/lib/server/og.ts)をそのまま再利用して、
// ランディングページの背景演出用サンプル画像を生成する。
// アバターは実在ユーザーの画像を使わず、本番コードにも存在する
// 「頭文字プレースホルダー」フォールバックをそのまま使う(avatarDataUri: null)。
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const outDir = path.join(rootDir, 'static', 'landing');

const samples = [
	{ file: 'ogp-sample-1.png', body: '推しキャラの一番好きなところを教えてください!' },
	{
		file: 'ogp-sample-2.png',
		body: 'いつも配信見てます!最近始めた趣味とかありますか?ちょっとした雑談でも嬉しいです。'
	},
	{
		file: 'ogp-sample-3.png',
		body: '今年やってみたいことを一つだけ挙げるとしたら何ですか? 些細なことでも大丈夫なので、気軽に教えてもらえると嬉しいです。次の目標にしてみたいので参考にさせてください。'
	}
];

async function main() {
	// loadFonts/loadIcon は appUrl に対して fetch() する実装のため、
	// static/ を配信できる実際のdevサーバーを起動して読み込む(本番コードは変更しない)。
	const vite = await createServer({ server: { port: 0 } });
	await vite.listen();
	const address = vite.httpServer?.address();
	if (!address || typeof address === 'string') throw new Error('failed to start vite dev server');
	const appUrl = `http://localhost:${address.port}`;

	try {
		const og = await vite.ssrLoadModule('/src/lib/server/og.ts');

		await og.ensureInit();
		const fonts = await og.loadFonts(appUrl);
		const icon = await og.loadIcon(appUrl);

		await mkdir(outDir, { recursive: true });

		for (const { file, body } of samples) {
			const svg = await og.satori(
				og.buildMessageOgSvgNode({
					body,
					sender: null,
					creatorName: 'あなた',
					boxName: 'めやすばこ',
					senderAvatarDataUri: null,
					creatorAvatarDataUri: null,
					icon
				}),
				{
					width: 1200,
					height: 630,
					fonts: [
						{ name: 'Noto Sans JP', data: fonts.noto, weight: 400, style: 'normal' },
						{ name: 'KillGothic', data: fonts.kill, weight: 400, style: 'normal' }
					]
				}
			);

			const resvg = new og.Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
			const png = resvg.render().asPng();

			const outPath = path.join(outDir, file);
			await writeFile(outPath, png);
			console.log(`[generate-landing-ogp] wrote ${path.relative(rootDir, outPath)}`);
		}
	} finally {
		await vite.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
