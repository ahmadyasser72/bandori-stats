import { defineRelations } from "drizzle-orm";

import * as schema from ".";

export const relations = defineRelations(schema, (r) => ({
	accounts: {
		snapshots: r.many.accountSnapshots({
			from: r.accounts.id,
			to: r.accountSnapshots.accountId,
			alias: "account_snapshots",
		}),
	},
	accountSnapshots: {
		account: r.one.accounts({
			from: r.accountSnapshots.accountId,
			to: r.accounts.id,
			alias: "snapshot_account",
			optional: false,
		}),
	},

	gbpEvents: {
		snapshots: r.many.trackerSnapshots({
			from: r.gbpEvents.id,
			to: r.trackerSnapshots.trackingId,
			where: { trackingFor: "event" },
		}),
		musics: r.many.gbpEventMusics({
			from: r.gbpEvents.id,
			to: r.gbpEventMusics.eventId,
		}),
	},
	gbpMonthlyRankings: {
		snapshots: r.many.trackerSnapshots({
			from: r.gbpMonthlyRankings.id,
			to: r.trackerSnapshots.trackingId,
			where: { trackingFor: "monthly" },
		}),
	},
}));
