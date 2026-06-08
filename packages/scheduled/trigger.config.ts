import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
	project: "proj_whqjzbgkgslcubigolcl",
	runtime: "bun",
	logLevel: "debug",
	maxDuration: 3600,
	machine: "micro",
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 2,
			minTimeoutInMs: 5_000,
			maxTimeoutInMs: 15_000,
			factor: 2,
			randomize: true,
		},
	},

	dirs: ["./src/trigger"],
	ignorePatterns: ["**/bestdori-*.ts"],
});
