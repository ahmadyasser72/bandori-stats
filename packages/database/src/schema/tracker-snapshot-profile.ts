export interface PlayerAvatar {
	id: number;
	trained: boolean;
}

export interface PlayerBand {
	name: string;
	members: [
		PlayerBandMember | null,
		PlayerBandMember | null,
		PlayerBandMember | null,
		PlayerBandMember | null,
		PlayerBandMember | null,
	];
}

export interface PlayerBandMember extends PlayerAvatar {
	level: number;
	skillLevel: number;
}
