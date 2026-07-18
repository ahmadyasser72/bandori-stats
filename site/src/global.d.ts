declare global {
	declare const __GIT_HASH__: string;
	declare const __GIT_URL__: string;

	var htmx: typeof import("htmx.org").default;
}

export {};
