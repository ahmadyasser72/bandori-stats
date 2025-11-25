import { defineConfig } from "drizzle-kit";

import { databaseToken, databaseUrl, isProduction } from "./src/db";

export default defineConfig({
	dialect: isProduction ? "turso" : "sqlite",
	schema: "./src/schema.ts",
	dbCredentials: { url: databaseUrl, authToken: databaseToken },
});
