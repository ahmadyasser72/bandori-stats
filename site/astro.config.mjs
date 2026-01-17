// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({ imageService: "passthrough" }),
	output: "server",

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
	},
	devToolbar: { enabled: false },
});
