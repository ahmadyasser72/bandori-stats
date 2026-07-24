import { defineConfig } from "drizzle-kit";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
if (!DATABASE_URL || !DATABASE_AUTH_TOKEN)
	throw new Error("Database credentials are missing.");

export default defineConfig({
	dialect: "turso",
	schema: "./src/schema/index.ts",
	dbCredentials: { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN },
});
