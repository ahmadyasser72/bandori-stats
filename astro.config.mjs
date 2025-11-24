// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare({
		workerEntryPoint: { path: "src/worker.ts" },
		imageService: "passthrough",
	}),
	output: "server",

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
