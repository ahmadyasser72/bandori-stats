import type { SSRManifest } from "astro";
import { App } from "astro/app";

import { handle } from "@astrojs/cloudflare/handler";

export function createExports(manifest: SSRManifest) {
	const app = new App(manifest);
	return {
		default: {
			async fetch(request, env, ctx) {
				// @ts-expect-error upstream types mismatch
				return handle(manifest, app, request, env, ctx);
			},
			async scheduled(_, _env) {},
		} satisfies ExportedHandler<CloudflareBindings>,
	};
}
