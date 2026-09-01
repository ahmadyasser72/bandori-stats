import type { Account } from "@bandori-stats/database/schema";

export const getProfileIcon = ({ profileArt }: Pick<Account, "profileArt">) =>
	`/assets/cards/${profileArt!.id}-${profileArt!.trained ? "trained" : "normal"}-icon.webp`;

export const getEventBanner = ({ id }: { id: number }) =>
	`/assets/events/${id}-banner.webp`;

export const getTitleImage = (id: number) => `/assets/titles/${id}.webp`;

export const getTrackerBgm = (id: number, kind: "event" | "monthly") =>
	`/assets/tracker/${kind}-${id}-bgm.mp3`;

export const getTrackerBackground = (
	id: number,
	kind: "event" | "monthly",
	variant: 1 | 2,
) => `/assets/tracker/${kind}-${id}-background-${variant}.webp`;

export const getTrackerLogo = (id: number, kind: "event" | "monthly") =>
	`/assets/tracker/${kind}-${id}-logo.webp`;
