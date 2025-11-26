import { defineConfig } from "drizzle-kit";

import { databaseToken, databaseUrl } from "./src/db";

export default defineConfig({
	dialect: "turso",
	schema: "./src/schema/index.ts",
	dbCredentials: { url: databaseUrl, authToken: databaseToken },
});
