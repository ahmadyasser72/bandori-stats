import {
	accountHasNickname,
	compareValue,
	displayValue,
	formatNumber,
	titleCase,
	type StatValue,
} from "@bandori-stats/bestdori/helpers";
import type { Account, Snapshot } from "@bandori-stats/database/schema";

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";

import { STAT_BADGES } from "./_stat-colors";

const STAT_NAMES = [
	"bandRating",
	"rank",
	"highScoreRating",
	"titles",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
] as const;

type RenderContext = "site" | "takumi";

export interface SnapshotCardProps extends Pick<
	Snapshot,
	"snapshotDate" | "stats"
> {
	account: Pick<Account, "nickname" | "username">;
	previous?: Pick<Snapshot, "snapshotDate" | "stats">;
	context?: RenderContext;
	children?: ComponentChildren;
}

export const SnapshotCard = ({
	account,
	snapshotDate,
	stats,
	previous,
	context = "site",
	children,
	...props
}: SnapshotCardProps) => (
	<div
		class="card w-full bg-base-100 shadow-sm card-border dark:bg-base-300"
		{...props}
	>
		<div class="card-body gap-2 p-4">
			<div class="flex h-12 w-full justify-between">
				{accountHasNickname(account) ? (
					<div>
						<h2 class="card-title">{account.nickname}</h2>
						<p class="text-xs text-base-content/80">@{account.username}</p>
					</div>
				) : (
					<h2 class="card-title self-center text-xl">@{account.username}</h2>
				)}

				<div class="text-end text-base-content/67">{snapshotDate}</div>
			</div>

			<div class="grid grid-cols-3 gap-2">
				{STAT_NAMES.map((name) => (
					<StatCell
						name={name}
						value={stats[name]}
						context={context}
						previousValue={previous?.stats[name]}
					/>
				))}
			</div>

			{children}
		</div>
	</div>
);

interface StatCellProps {
	name: keyof Snapshot["stats"];
	value: StatValue;
	previousValue: StatValue;
	context: RenderContext;
}

const StatCell = ({ name, value, previousValue, context }: StatCellProps) => {
	const delta = compareValue(value, previousValue);
	const wideColumn = name === "bandRating" || name === "highScoreRating";

	return (
		<div
			class={clsx([
				"flex items-center justify-between rounded-box border-base-300 p-2 not-dark:border dark:bg-base-200",
				wideColumn && "col-span-2",
				value === null && "opacity-34",
			])}
		>
			<div>
				<p class="text-base-content/67">
					{titleCase(name.replace(/Count$/, ""))}
				</p>
				<p class="font-bold">
					<span class="text-sm">{displayValue(value)}</span>

					{!wideColumn && delta > 0 && (
						<StatCellDeltaBadge
							class="ml-1 badge-xs"
							name={name}
							value={previousValue}
							context={context}
							delta={delta}
						/>
					)}
				</p>
			</div>

			{wideColumn && delta > 0 && (
				<StatCellDeltaBadge
					name={name}
					value={previousValue}
					context={context}
					delta={delta}
				/>
			)}
		</div>
	);
};

interface StatCellDeltaBadgeProps {
	name: keyof Snapshot["stats"];
	delta: number;
	value: StatValue;
	context: RenderContext;
	class?: string;
}

const StatCellDeltaBadge = ({
	name,
	delta,
	value,
	context,
	class: className,
}: StatCellDeltaBadgeProps) => {
	return (
		<span
			class={clsx([
				"badge badge-soft font-bold",
				STAT_BADGES[name],
				context === "site" && "tooltip",
				className,
			])}
			data-tip={`from: ${displayValue(value)}`}
		>
			{formatNumber(delta, { autoCompact: true, positiveSign: true })}
		</span>
	);
};
