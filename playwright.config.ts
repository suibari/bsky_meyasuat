import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT, MOCK_POSTGREST_PORT } from './tests/e2e/fixtures';

const baseURL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'line',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: [
		{
			command: 'node tests/e2e/mock-postgrest.mjs',
			url: `http://127.0.0.1:${MOCK_POSTGREST_PORT}/users`,
			env: { MOCK_POSTGREST_PORT: String(MOCK_POSTGREST_PORT) },
			reuseExistingServer: !process.env.CI,
			timeout: 30_000
		},
		{
			command: `npm run dev -- --host 127.0.0.1 --port ${E2E_PORT} --strictPort`,
			url: baseURL,
			env: {
				E2E_WRANGLER_CONFIG: 'tests/e2e/wrangler.e2e.toml',
				PUBLIC_APP_URL: baseURL,
				PUBLIC_TURNSTILE_SITE_KEY: ''
			},
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		}
	]
});
