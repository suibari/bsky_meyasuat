import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				// E2E(Playwright)ではモックPostgREST等を向いた専用設定に差し替える(tests/e2e/wrangler.e2e.toml)
				platformProxy: {
					configPath: process.env.E2E_WRANGLER_CONFIG ?? 'wrangler.toml',
					environment: undefined,
					persist: { path: process.env.E2E_WRANGLER_CONFIG ? '.wrangler/e2e-state' : '.wrangler/state/v3' }
				}
			})
		})
	],
	optimizeDeps: {
		exclude: ['@resvg/resvg-wasm']
	},
	ssr: {
		noExternal: ['svelte-i18n', 'svelte-turnstile', '@atproto/api']
	}
});
