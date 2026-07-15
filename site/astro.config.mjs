// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({
		imageService: "passthrough",
		prerenderEnvironment: "node",
	}),
	output: "server",
	cache: { provider: cacheCloudflare() },

	env: {
		schema: {
			DATABASE_URL: envField.string({ access: "secret", context: "server" }),
			DATABASE_AUTH_TOKEN: envField.string({
				access: "secret",
				context: "server",
			}),
			UPSTASH_REDIS_REST_URL: envField.string({
				access: "secret",
				context: "server",
			}),
			UPSTASH_REDIS_REST_TOKEN: envField.string({
				access: "secret",
				context: "server",
			}),

			UMAMI_SITE_ID: envField.string({
				access: "public",
				context: "server",
				optional: true,
			}),
		},
	},

	build: { concurrency: 4 },
	vite: {
		plugins: [tailwindcss()],
		server: { allowedHosts: [".lhr.life", ".opah-barley.ts.net"] },

		build: {
			rolldownOptions: {
				output: { assetFileNames: "_astro/[hash][extname]" },
			},
		},
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							entryFileNames: "_astro/js/[hash].js",
							chunkFileNames: "_astro/js/[hash].js",
							assetFileNames: "_astro/[hash][extname]",
						},
					},
				},
			},
		},
	},

	devToolbar: { enabled: false },
});
