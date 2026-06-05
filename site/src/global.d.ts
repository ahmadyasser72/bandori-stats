import type { Region } from "@bandori-stats/bestdori/constants";

declare global {
	var htmx: typeof import("htmx.org").default;

	namespace App {
		interface Locals {
			query: Record<string, string | string[]>;
			region: Region | null;
		}
	}
}

export {};
