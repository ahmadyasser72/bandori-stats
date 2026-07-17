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
import type z from "zod";

import type { ratioSchema } from "~/lib/schema";
import { STAT_BADGES, STAT_TOOLTIPS } from "./_stat-colors";

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
	ratio: z.infer<typeof ratioSchema>;
	context?: RenderContext;
	children?: ComponentChildren;
}

export const SnapshotCard = ({
	account,
	snapshotDate,
	stats,
	previous,
	ratio,
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
				{STAT_NAMES.map((name) => {
					const useRatio =
						(name === "fullComboCount" || name === "allPerfectCount") &&
						ratio.includes(name) &&
						stats[name] &&
						stats.clearCount;

					const [ratioValue, previousRatio] = useRatio
						? [
								(stats[name]! / stats.clearCount!) * 100,
								previous?.stats[name] && previous.stats.clearCount
									? (previous.stats[name] / previous.stats.clearCount) * 100
									: undefined,
							]
						: [];

					return (
						<StatCell
							name={name}
							value={stats[name]}
							context={context}
							previousRatio={previousRatio}
							previousValue={previous?.stats[name]}
							ratio={ratioValue}
						/>
					);
				})}
			</div>

			{children}
		</div>
	</div>
);

interface StatCellProps {
	name: keyof Snapshot["stats"];
	value: StatValue;
	previousValue: StatValue;
	ratio?: number;
	previousRatio?: number;
	context: RenderContext;
}

const StatCell = ({
	name,
	value,
	previousValue,
	ratio,
	previousRatio,
	context,
}: StatCellProps) => {
	const delta = compareValue(value, previousValue);
	const ratioDelta = compareValue(ratio, previousRatio);
	const showDelta = ratioDelta ? Math.abs(ratioDelta) >= 0.01 : delta > 0;
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
					{ratio && " (%)"}
				</p>
				<div class="inline-flex items-center font-bold">
					<span
						class={clsx([
							"text-sm",
							context === "site" && ratio && "tooltip",
							STAT_TOOLTIPS[name],
						])}
						data-tip={displayValue(value)}
					>
						{displayValue(ratio ?? value)}
						{ratio && "%"}
					</span>

					{!wideColumn && showDelta && (
						<StatCellDeltaBadge
							class="ml-1 badge-xs"
							name={name}
							context={context}
							delta={delta}
							previousRatio={previousRatio}
							previousValue={previousValue}
							ratioDelta={ratioDelta}
						/>
					)}
				</div>
			</div>

			{wideColumn && showDelta && (
				<StatCellDeltaBadge
					name={name}
					context={context}
					delta={delta}
					previousRatio={previousRatio}
					previousValue={previousValue}
					ratioDelta={ratioDelta}
				/>
			)}
		</div>
	);
};

interface StatCellDeltaBadgeProps {
	name: keyof Snapshot["stats"];
	previousValue: StatValue;
	delta: number;
	previousRatio?: number;
	ratioDelta?: number;
	context: RenderContext;
	class?: string;
}

const StatCellDeltaBadge = ({
	name,
	delta,
	previousValue,
	ratioDelta,
	previousRatio,
	context,
	class: className,
}: StatCellDeltaBadgeProps) => {
	const displayDelta = ratioDelta || delta;
	return (
		<span
			class={clsx([
				"badge badge-soft font-bold",
				displayDelta > 0 ? STAT_BADGES[name] : "badge-error",
				context === "site" && "tooltip",
				displayDelta > 0 ? STAT_TOOLTIPS[name] : "tooltip-error",
				className,
			])}
			data-tip={
				displayDelta && previousRatio
					? `${displayDelta > 0 ? "rise" : "dropped"} from: ${displayValue(previousRatio)}%`
					: `from: ${displayValue(previousValue)}`
			}
		>
			{formatNumber(displayDelta, { autoCompact: true, positiveSign: true })}
			{ratioDelta ? "%" : ""}
		</span>
	);
};
