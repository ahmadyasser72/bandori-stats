import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import z from "zod";

export const PAGE = z.coerce.number().positive().catch(1);

export const RANK_BY = z
	.array(z.enum(STAT_COLUMNS))
	.nonempty()
	.catch(() => [...STAT_COLUMNS]);
