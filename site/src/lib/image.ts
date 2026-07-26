import type { Account } from "@bandori-stats/database/schema";

export const getProfileIcon = ({ profileArt }: Pick<Account, "profileArt">) =>
	`/static/cards/${profileArt!.id}-${profileArt!.trained ? "trained" : "normal"}-icon.webp`;

export const getTitleImage = (id: number) => `/static/titles/${id}.webp`;
