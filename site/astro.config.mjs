// @ts-check
import { defineConfig, envField } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({ imageService: "passthrough" }),
	output: "server",

	env: {
		schema: {
			DATABASE_URL: envField.string({ access: "secret", context: "server" }),
			DATABASE_AUTH_TOKEN: envField.string({
				access: "secret",
				context: "server",
			}),
		},
	},

	vite: {
		plugins: [tailwindcss()],

		build: {
			rollupOptions: {
				output: {
					entryFileNames: "js/[hash:10].js",
					chunkFileNames: "js/[hash:10].js",
				},
			},
		},
		css: {
			transformer:
				process.env.NODE_ENV === "development" ? "postcss" : "lightningcss",
		},
	},
	devToolbar: { enabled: false },
});
