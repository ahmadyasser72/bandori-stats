import z from "zod";

import dayjs from "./date";

export const maybeArray = <T extends z.ZodType>(schema: T) =>
	z.union([z.array(schema).nonempty(), schema]);
export const alwaysArray = <T extends z.ZodType>(schema: T) =>
	schema.apply(maybeArray).transform((it) => (Array.isArray(it) ? it : [it]));

export const IdSchema = z.coerce.number().nonnegative();
export const IsoDateWithDefault = z.iso
	.date()
	.catch(() => dayjs.tz().format("YYYY-MM-DD"));
export const RatioSchema = z
	.enum(["fullComboCount", "allPerfectCount"])
	.apply(alwaysArray)
	.catch(() => []);
export const QuerySchema = z
	.string()
	.transform((s) => s.replace(/^@/, ""))
	.catch("");
