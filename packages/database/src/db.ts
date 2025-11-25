import { drizzle } from "drizzle-orm/libsql/http";

import * as schema from "./schema";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
if (!DATABASE_URL || !DATABASE_AUTH_TOKEN)
	throw new Error("Database credentials are missing.");

export const databaseUrl = DATABASE_URL;
export const databaseToken = DATABASE_AUTH_TOKEN!;

export const db = drizzle({
	schema,
	connection: { url: databaseUrl, authToken: databaseToken },
});

export * from "drizzle-orm";
