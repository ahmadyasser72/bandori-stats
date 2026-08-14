import { createDecipheriv } from "node:crypto";

import { AbortTaskRunError } from "@trigger.dev/sdk";
import type z from "zod";

import { limitAsync } from "@bandori-stats/bestdori/helpers";
import type { GameEventType } from "@bandori-stats/bestdori/schema/misc";

const USER_AGENT =
	"UnityPlayer/2022.3.62f2 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)";
const UNITY_VERSION = "2022.3.62f2";

type ResponseType = "monthly" | z.infer<typeof GameEventType>;

const PROTO_MAP = {
	monthly: () =>
		import("./proto/monthly-ranking.proto.js").then(
			(it) => it.UserMonthlyRankingRankingResponse,
		),
	story: () =>
		import("./proto/event-story.proto.js").then(
			(it) => it.UserStoryEventRankingResponse,
		),
	versus: () =>
		import("./proto/event-versus.proto.js").then(
			(it) => it.UserVersusEventRankingResponse,
		),
	mission_live: () =>
		import("./proto/event-mission_live.proto.js").then(
			(it) => it.UserMissionLiveEventRankingResponse,
		),
	challenge: () =>
		import("./proto/event-challenge.proto.js").then(
			(it) => it.UserChallengeEventRankingResponse,
		),
	live_try: () =>
		import("./proto/event-live_try.proto.js").then(
			(it) => it.UserLiveTryEventRankingResponse,
		),
	medley: () =>
		import("./proto/event-medley.proto.js").then(
			(it) => it.UserMedleyEventRankingResponse,
		),
	festival: () =>
		import("./proto/event-festival.proto.js").then(
			(it) => it.UserTeamLiveFestivalEventRankingResponse,
		),
} satisfies Record<ResponseType, () => unknown>;

export const bangDream = limitAsync(
	async <
		T extends ResponseType,
		O = ReturnType<Awaited<ReturnType<(typeof PROTO_MAP)[T]>>["decode"]>,
	>(
		version: string,
		type: T,
		id: number,
	) => {
		const {
			BANG_DREAM_USER_ID,
			BANG_DREAM_USER_TOKEN,
			BANG_DREAM_USER_SIGNATURE,
		} = process.env;
		if (
			!BANG_DREAM_USER_ID ||
			!BANG_DREAM_USER_TOKEN ||
			!BANG_DREAM_USER_SIGNATURE
		)
			throw new AbortTaskRunError("BanG Dream credentials are missing.");

		const { BANG_DREAM_AES_KEY, BANG_DREAM_AES_IV } = process.env;
		if (!BANG_DREAM_AES_KEY || !BANG_DREAM_AES_IV)
			throw new AbortTaskRunError("BanG Dream decryption keys are missing.");

		const path =
			type === "monthly"
				? `monthlyranking/${id}/ranking`
				: `event/${id}/${type}/ranking`;
		const url = new URL(
			path,
			`https://api.app-bang-dream-gbp.com/api/user/${BANG_DREAM_USER_ID}/`,
		);

		const headers = {
			host: "api.app-bang-dream-gbp.com",
			"user-agent": USER_AGENT,
			"accept-encoding": "deflate, gzip",
			"content-type": "application/octet-stream",
			accept: "application/octet-stream",
			"x-clientversion": version,
			"x-signature": BANG_DREAM_USER_SIGNATURE,
			"x-token": BANG_DREAM_USER_TOKEN,
			"x-clientplatform": "Android",
			"x-unity-version": UNITY_VERSION,
		};

		const response = await fetch(url, { headers });
		if (!response.ok)
			throw new AbortTaskRunError(`Response is not OK (${response.status})`);

		const bytes = await response.arrayBuffer().then(decrypt);
		const proto = await PROTO_MAP[type]();
		return proto.decode(bytes) as O;
	},
	1,
);

const decrypt = async (data: ArrayBuffer) => {
	const { BANG_DREAM_AES_KEY, BANG_DREAM_AES_IV } = process.env;
	if (!BANG_DREAM_AES_KEY || !BANG_DREAM_AES_IV)
		throw new AbortTaskRunError("BanG Dream decryption keys are missing.");

	const key = Buffer.from(BANG_DREAM_AES_KEY);
	const iv = Buffer.from(BANG_DREAM_AES_IV);

	const decipher = createDecipheriv("aes-128-cbc", key, iv);
	decipher.setAutoPadding(false);

	const plain = Buffer.concat([
		decipher.update(Buffer.from(data)),
		decipher.final(),
	]);

	const paddingLength = plain[plain.length - 1];
	return plain.subarray(0, plain.length - paddingLength);
};
