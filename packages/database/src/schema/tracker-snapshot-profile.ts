export type PlayerAvatar = Pick<PlayerBandMember, "id" | "illust">;

export interface PlayerBand {
	name: string;
	center: PlayerBandMember | null;
	members: [
		PlayerBandMember | null,
		PlayerBandMember | null,
		PlayerBandMember | null,
		PlayerBandMember | null,
	];
}

export interface PlayerBandMember {
	id: number;
	level: number;
	illust: "normal" | "after_training";
	skillLevel: number;
}

export type PlayerTitles = Record<"first" | "second", number | null>;
