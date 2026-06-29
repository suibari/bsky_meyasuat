// vite build 後に実行。
// 1. resvg / yoga の .wasm を Cloudflare 出力ディレクトリへコピー
// 2. _worker.js の先頭に静的 import を注入して、Cloudflare のデプロイ時
//    バンドラが事前コンパイル済み WebAssembly.Module として解決できるようにする
//    （Vite を通さないことが重要。Vite は .wasm を fetch/url に加工してしまう）
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const OUT_DIR = '.svelte-kit/cloudflare';
const WORKER = path.join(OUT_DIR, '_worker.js');

const wasmFiles = [
	{ src: require.resolve('@resvg/resvg-wasm/index_bg.wasm'), dest: 'resvg.wasm', binding: '__OG_RESVG_WASM' },
	{ src: require.resolve('satori/yoga.wasm'), dest: 'yoga.wasm', binding: '__OG_YOGA_WASM' }
];

if (!existsSync(WORKER)) {
	console.error(`[inject-wasm] ${WORKER} が見つかりません。先に \`vite build\` を実行してください。`);
	process.exit(1);
}

for (const { src, dest } of wasmFiles) {
	copyFileSync(src, path.join(OUT_DIR, dest));
	console.log(`[inject-wasm] copied ${dest}`);
}

const MARKER = '/* inject-wasm */';
let worker = readFileSync(WORKER, 'utf8');

if (worker.includes(MARKER)) {
	console.log('[inject-wasm] already injected, skipping');
} else {
	const imports = wasmFiles
		.map(({ dest, binding }) => `import ${binding} from './${dest}';`)
		.join('\n');
	const assigns = wasmFiles
		.map(({ binding }) => `globalThis.${binding} = ${binding};`)
		.join('\n');
	worker = `${MARKER}\n${imports}\n${assigns}\n${worker}`;
	writeFileSync(WORKER, worker);
	console.log('[inject-wasm] injected wasm imports into _worker.js');
}
