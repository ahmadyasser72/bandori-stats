import * as schema from "./schema";

export const isProduction = process.env.NODE_ENV === "production";
const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
if (isProduction && (!DATABASE_URL || !DATABASE_AUTH_TOKEN))
	throw new Error("Database credentials are missing.");

export const databaseUrl = isProduction ? DATABASE_URL! : "file:local.db";
export const databaseToken = DATABASE_AUTH_TOKEN!;

export const createDrizzle = isProduction
	? () =>
			import("drizzle-orm/libsql/http").then(({ drizzle }) =>
				drizzle({
					schema,
					connection: { url: databaseUrl, authToken: databaseToken },
				}),
			)
	: () =>
			import("drizzle-orm/libsql/sqlite3").then(({ drizzle }) =>
				drizzle(databaseUrl, { schema }),
			);

export * from "drizzle-orm";
