import z from "zod";

import dayjs from "~/lib/date";

export const maybeArray = <T extends z.ZodType>(schema: T) =>
	z.union([z.array(schema).nonempty(), schema]);
export const dateSchema = z.iso
	.date()
	.catch(() => dayjs.tz().format("YYYY-MM-DD"));
export const idSchema = z.coerce.number().nonnegative();
