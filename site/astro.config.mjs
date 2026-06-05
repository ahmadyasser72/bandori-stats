// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({ imageService: "passthrough" }),
	output: "server",

	redirects: {
		"/history": "/en/history",
		"/compare": "/en/compare",
		"/history/rows": "/en/history/rows",
		"/history/for/*": "/en/history/for/:match",
		"/compare/search": "/en/compare/search",
		"/discord-bot/*": "/en/discord-bot/:match",
		"/static/*": "/en/static/:match",
	},

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

	vite: {
		plugins: [tailwindcss()],
		ssr: { external: ["node:fs", "node:path", "sharp"] },

		build: {
			rollupOptions: {
				output: {
					entryFileNames: "js/[hash:10].js",
					chunkFileNames: "js/[hash:10].js",
				},
			},
		},

		server: { allowedHosts: [".lhr.life"] },
	},
	devToolbar: { enabled: false },
});
