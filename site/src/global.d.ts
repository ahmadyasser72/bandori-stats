declare global {
	declare const __GIT_HASH__: string;
	declare const __GITHUB_URL__: string;

	interface Window {
		htmx: typeof import("htmx.org").default;
	}
}

export {};
