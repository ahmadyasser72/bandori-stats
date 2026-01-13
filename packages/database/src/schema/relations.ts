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
}));
