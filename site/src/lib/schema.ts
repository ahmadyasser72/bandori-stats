import z from "zod";

import dayjs from "~/lib/date";

export const maybeArray = <T extends z.ZodType>(schema: T) =>
	z.union([z.array(schema).nonempty(), schema]);
export const alwaysArray = <T extends z.ZodType>(schema: T) =>
	schema.apply(maybeArray).transform((it) => (Array.isArray(it) ? it : [it]));

export const dateSchema = z.iso.date().catch(dayjs.utc().format("YYYY-MM-DD"));
export const idSchema = z.number().nonnegative();
