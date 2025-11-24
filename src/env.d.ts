type Runtime = import("@astrojs/cloudflare").Runtime<CloudflareBindings>;

declare namespace App {
	interface Locals extends Runtime {
		db: ReturnType<typeof import("~/db").createDrizzle>;
	}
}
