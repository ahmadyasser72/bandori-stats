import { defineConfig } from "drizzle-kit";

import { databaseToken, databaseUrl } from "./src/db";

export default defineConfig({
	dialect: "turso",
	schema: "./src/schema.ts",
	dbCredentials: { url: databaseUrl, authToken: databaseToken },
});
