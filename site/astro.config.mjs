// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({
		imageService: "passthrough",
		prerenderEnvironment: "node",
	}),
	output: "server",
	cache: { provider: cacheCloudflare() },
	session: {
		driver: {
			entrypoint: "unstorage/drivers/null",
		},
	},

	integrations: [preact()],
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: "Cause",
			cssVariable: "--font-cause",
			subsets: ["latin"],
			weights: ["100 900"],
			fallbacks: [],
		},
		{
			provider: fontProviders.google(),
			name: "Kosugi Maru",
			cssVariable: "--font-kosugi-maru",
			subsets: ["japanese", "latin-ext"],
			fallbacks: [],
			formats: ["ttf"],
		},
		{
			provider: fontProviders.fontsource(),
			name: "M PLUS Rounded 1c",
			cssVariable: "--font-m-plus-rounded-1c",
			subsets: [
				"cyrillic",
				"cyrillic-ext",
				"greek",
				"greek-ext",
				"hebrew",
				"vietnamese",
			],
			weights: ["100 900"],
		},
	],

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
