// Generate English title images (title-en.png, title-nav-en.png) using the same
// Satori+resvg pipeline as the OGP card generation.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const outDir = path.join(rootDir, 'static');

const images = [
	{
		file: 'title-en.png',
		text: 'MeyasuAt',
		width: 1713,
		height: 314,
		fontSize: 240,
		color: '#ffffff'
	},
	{
		file: 'title-nav-en.png',
		text: 'MeyasuAt',
		width: 845,
		height: 145,
		fontSize: 100,
		color: '#38bdf8'
	}
];

function buildTextSvgNode(text, fontSize, color) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: '100%',
				height: '100%',
				backgroundColor: 'transparent',
				fontSize: `${fontSize}px`,
				fontWeight: 700,
				color: color,
				fontFamily: '"KillGothic"'
			},
			children: text
		}
	};
}

async function main() {
	const vite = await createServer({ server: { port: 0 } });
	await vite.listen();
	const address = vite.httpServer?.address();
	if (!address || typeof address === 'string') throw new Error('failed to start vite dev server');
	const appUrl = `http://localhost:${address.port}`;

	try {
		const og = await vite.ssrLoadModule('/src/lib/server/og.ts');

		await og.ensureInit();
		const fonts = await og.loadFonts(appUrl);

		for (const { file, text, width, height, fontSize, color } of images) {
			const svg = await og.satori(
				{
					type: 'div',
					props: {
						style: {
							width: `${width}px`,
							height: `${height}px`,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						},
						children: buildTextSvgNode(text, fontSize, color)
					}
				},
				{
					width,
					height,
					fonts: [
						{ name: 'KillGothic', data: fonts.kill, weight: 700, style: 'normal' }
					]
				}
			);

			const resvg = new og.Resvg(svg, { fitTo: { mode: 'width', value: width } });
			const png = resvg.render().asPng();

			const outPath = path.join(outDir, file);
			await writeFile(outPath, png);
			console.log(`[generate-title-images] wrote ${path.relative(rootDir, outPath)}`);
		}
	} finally {
		await vite.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
