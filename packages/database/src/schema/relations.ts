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
			from: r.gbpEvents.eventId,
			to: r.trackerSnapshots.trackingId,
			alias: "event_tracker",
			where: { trackingFor: "event" },
		}),
	},
	gbpMonthlyRankings: {
		snapshots: r.many.trackerSnapshots({
			from: r.gbpMonthlyRankings.monthlyRankingId,
			to: r.trackerSnapshots.trackingId,
			alias: "monthly_tracker",
			where: { trackingFor: "monthly" },
		}),
	},
	trackerSnapshots: {
		profiles: r.many.trackerSnapshotProfiles({
			from: r.trackerSnapshots.uid,
			to: r.trackerSnapshotProfiles.uid,
			alias: "tracker_snapshot_profile",
		}),
	},
}));
