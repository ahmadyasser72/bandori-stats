import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export const createDrizzle = (db: D1Database) =>
	drizzle(db, { casing: "snake_case", schema });
