import type { R2Bucket } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user: {
				did: string;
				handle: string;
				displayName: string | null;
				avatarUrl: string | null;
				notifyEnabled: boolean;
				shareHandleEnabled: boolean;
				boxName: string | null;
			} | null;
			sessionId: string | null;
			lang: 'ja' | 'en';
		}
		interface PageData {
			user?: App.Locals['user'];
			lang: 'ja' | 'en';
		}
		interface Platform {
			env: {
				R2: R2Bucket;
				POSTGREST_URL: string;
				CF_ACCESS_CLIENT_ID: string;
				CF_ACCESS_CLIENT_SECRET: string;
				BOT_HANDLE: string;
				BOT_APP_PASSWORD: string;
				R2_PUBLIC_URL: string;
				TURNSTILE_SECRET_KEY: string;
				SESSION_SECRET: string;
				PUBLIC_APP_URL: string;
				PUBLIC_TURNSTILE_SITE_KEY: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage;
		}
	}
}

export {};
