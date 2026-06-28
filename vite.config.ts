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
				platformProxy: {
					configPath: 'wrangler.toml',
					environment: undefined,
					persist: { path: '.wrangler/state/v3' }
				}
			})
		})
	],
	optimizeDeps: {
		exclude: ['@resvg/resvg-wasm']
	},
	ssr: {
		noExternal: ['svelte-i18n', 'svelte-turnstile']
	}
});
