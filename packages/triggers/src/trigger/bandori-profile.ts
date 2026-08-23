import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { GBP, redis } from "@bandori-stats/database/redis";
import { bangDreamProfile } from "~/bang-dream-gbp/fetch";

export const bandoriProfile = schemaTask({
	id: "bandori-profile",
	queue: { concurrencyLimit: 1 },
	schema: z.strictObject({ uid: z.string() }),
	run: async ({ uid }) => {
		const version = await redis().get<string>(GBP.version);
		await tags.add([`uid_${uid}`, `version_${version ?? "n/a"}`]);
		if (!version) return;

		return bangDreamProfile(version, uid);
	},
});
