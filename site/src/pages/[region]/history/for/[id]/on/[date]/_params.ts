import z from "zod";

import { dateSchema, idSchema } from "~/lib/schema";

export const params = z.strictObject({ date: dateSchema, id: idSchema });
