import { createDecipheriv } from "node:crypto";

import { fromBinary, type Message } from "@bufbuild/protobuf";
import type { GenMessage } from "@bufbuild/protobuf/codegenv2";
import { AbortTaskRunError } from "@trigger.dev/sdk";
import type z from "zod";

import { limitAsync } from "@bandori-stats/bestdori/helpers";
import type { GameEventType } from "@bandori-stats/bestdori/schema/misc";

const USER_AGENT =
	"UnityPlayer/2022.3.62f2 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)";
const UNITY_VERSION = "2022.3.62f2";

type ResponseType = "monthly" | z.infer<typeof GameEventType>;

const PROTOBUF_MAP = {
	monthly: () =>
		import("./gen/monthly-ranking_pb").then(
			(it) => it.UserMonthlyRankingRankingResponseSchema,
		),
	story: () =>
		import("./gen/event-story_pb").then(
			(it) => it.UserStoryEventRankingResponseSchema,
		),
	versus: () =>
		import("./gen/event-versus_pb").then(
			(it) => it.UserVersusEventRankingResponseSchema,
		),
	mission_live: () =>
		import("./gen/event-mission_live_pb").then(
			(it) => it.UserMissionLiveEventRankingResponseSchema,
		),
	challenge: () =>
		import("./gen/event-challenge_pb").then(
			(it) => it.UserChallengeEventRankingResponseSchema,
		),
	live_try: () =>
		import("./gen/event-live_try_pb").then(
			(it) => it.UserLiveTryEventRankingResponseSchema,
		),
	medley: () =>
		import("./gen/event-medley_pb").then(
			(it) => it.UserMedleyEventRankingResponseSchema,
		),
	festival: () =>
		import("./gen/event-festival_pb").then(
			(it) => it.UserTeamLiveFestivalEventRankingResponseSchema,
		),
} satisfies Record<ResponseType, () => Promise<GenMessage<Message>>>;

interface ProtobufOutput {
	monthly: import("./gen/monthly-ranking_pb").UserMonthlyRankingRankingResponse;
	story: import("./gen/event-story_pb").UserStoryEventRankingResponse;
	versus: import("./gen/event-versus_pb").UserVersusEventRankingResponse;
	mission_live: import("./gen/event-mission_live_pb").UserMissionLiveEventRankingResponse;
	challenge: import("./gen/event-challenge_pb").UserChallengeEventRankingResponse;
	live_try: import("./gen/event-live_try_pb").UserLiveTryEventRankingResponse;
	medley: import("./gen/event-medley_pb").UserMedleyEventRankingResponse;
	festival: import("./gen/event-festival_pb").UserTeamLiveFestivalEventRankingResponse;
}

export const bangDream = limitAsync(
	async <T extends ResponseType>(version: string, type: T, id: number) => {
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
		const schema = await PROTOBUF_MAP[type]();
		return fromBinary(schema, bytes) as ProtobufOutput[T];
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
