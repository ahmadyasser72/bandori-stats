import { createCipheriv, createDecipheriv } from "node:crypto";

import {
	fromBinary,
	fromJson,
	toBinary,
	toJson,
	type Message,
} from "@bufbuild/protobuf";
import type { GenMessage } from "@bufbuild/protobuf/codegenv2";
import { AbortTaskRunError, logger, metadata } from "@trigger.dev/sdk";
import { limitAsync, retry } from "es-toolkit";
import type z from "zod";

import type { GameEventType } from "@bandori-stats/bestdori/schema/misc";
import {
	GBP,
	redis,
	type BangDreamCredentials,
} from "@bandori-stats/database/redis";
import {
	UserAuthRequestSchema,
	type UserAuthRequestJson,
} from "./gen/auth-request_pb";
import { UserChallengeEventRankingResponseSchema } from "./gen/event-challenge_pb";
import { UserTeamLiveFestivalEventRankingResponseSchema } from "./gen/event-festival_pb";
import { UserLiveTryEventRankingResponseSchema } from "./gen/event-live_try_pb";
import { UserMedleyEventRankingResponseSchema } from "./gen/event-medley_pb";
import { UserMissionLiveEventRankingResponseSchema } from "./gen/event-mission_live_pb";
import { UserStoryEventRankingResponseSchema } from "./gen/event-story_pb";
import { UserVersusEventRankingResponseSchema } from "./gen/event-versus_pb";
import { UserMonthlyRankingRankingResponseSchema } from "./gen/monthly-ranking_pb";
import { UserProfileSchema } from "./gen/profile_pb";

const USER_AGENT =
	"UnityPlayer/2022.3.62f2 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)";
const UNITY_VERSION = "2022.3.62f2";

type MetadataType = "monthly" | z.infer<typeof GameEventType>;
const PROTOBUF = {
	monthly: UserMonthlyRankingRankingResponseSchema,
	story: UserStoryEventRankingResponseSchema,
	versus: UserVersusEventRankingResponseSchema,
	mission_live: UserMissionLiveEventRankingResponseSchema,
	challenge: UserChallengeEventRankingResponseSchema,
	live_try: UserLiveTryEventRankingResponseSchema,
	medley: UserMedleyEventRankingResponseSchema,
	festival: UserTeamLiveFestivalEventRankingResponseSchema,
} satisfies Record<MetadataType, GenMessage<Message>>;

export class MaintenanceError extends Error {
	constructor() {
		super("Server Maintenance");
	}
}

const fetch = limitAsync(globalThis.fetch, 1);

export const bangDream = {
	leaderboard: async <T extends MetadataType>(
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

		let path: string;
		if (type === "monthly") path = `monthlyranking/${id}/ranking`;
		else {
			let typ: string = type;
			if (type === "live_try") typ = "livetry";
			if (type === "mission_live") typ = "mission";
			path = `event/${id}/${typ}/ranking`;
		}

		const auth = {
			uid: BANG_DREAM_USER_ID,
			token: BANG_DREAM_USER_TOKEN,
			signature: BANG_DREAM_USER_SIGNATURE,
		} satisfies BangDreamCredentials;
		const url = new URL(
			path,
			`https://api.app-bang-dream-gbp.com/api/user/${BANG_DREAM_USER_ID}/`,
		);

		return logger.trace("gbp-ranking", async (span) => {
			span.setAttribute?.("type", type);
			span.setAttribute?.("id", id);

			const response = await bangDream.fetch("GET", version, url, auth);
			return logger.trace("parse", async (span) => {
				const schema = PROTOBUF[type];
				span.setAttribute?.("typeName", schema.typeName);

				const output = fromBinary(schema, response.bytes);
				const json = toJson(schema, output);
				metadata.root.set(`${type}:${id}`, { path, output: json });
				return output;
			});
		});
	},
	profile: async (version: string, auth: BangDreamCredentials, uid: string) => {
		const url = new URL(
			`profile/${uid}`,
			`https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/`,
		);

		return logger.trace("gbp-profile", async (span) => {
			span.setAttribute?.("uid", uid);

			const response = await bangDream.fetch("PUT", version, url, auth);
			const newToken = response.headers.get("x-token");
			if (!newToken)
				throw new AbortTaskRunError(
					`Request to ${url.pathname} not returning new token`,
				);

			return logger.trace("parse", async (span) => {
				span.setAttribute?.("typeName", UserProfileSchema.typeName);

				const output = fromBinary(UserProfileSchema, response.bytes);
				const json = toJson(UserProfileSchema, output);
				metadata.root.set(`profile:${uid}`, { output: json });
				return { ...output, credentials: { ...auth, token: newToken } };
			});
		});
	},

	refreshToken: async (version: string, auth: BangDreamCredentials) => {
		const body = await redis().get<UserAuthRequestJson>(GBP.credentialsRequest);
		if (!body)
			throw new AbortTaskRunError("BanG Dream auth request body is missing.");

		const url = new URL(
			`https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/auth`,
		);
		const bytes = toBinary(
			UserAuthRequestSchema,
			fromJson(UserAuthRequestSchema, body),
		);
		const { headers } = await bangDream.fetch(
			"PUT",
			version,
			url,
			auth,
			encrypt(bytes.buffer).buffer,
		);

		const token = headers.get("x-token");
		if (!token)
			throw new AbortTaskRunError("BanG Dream auth request is invalid.");

		return token;
	},

	fetch: async (
		method: "GET" | "PUT",
		version: string,
		url: URL,
		auth: BangDreamCredentials,
		body?: ArrayBuffer,
	): Promise<{ bytes: Buffer<ArrayBuffer>; headers: Headers }> =>
		logger.trace("fetch", async (span) => {
			span.setAttribute?.("request", `${method}: ${url}`);

			const response = await retry(
				() =>
					fetch(url, {
						method,
						headers: {
							host: "api.app-bang-dream-gbp.com",
							"user-agent": USER_AGENT,
							"accept-encoding": "deflate, gzip",
							"content-type": "application/octet-stream",
							accept: "application/octet-stream",
							"x-clientversion": version,
							"x-signature": auth.signature,
							"x-token": auth.token,
							"x-clientplatform": "Android",
							"x-unity-version": UNITY_VERSION,
						},
						body,
					}),
				{
					retries: 2,
					delay: 500,
					shouldRetry: (error) => error instanceof TypeError,
				},
			);
			span.setAttribute?.("status", response.status);

			if (!response.ok) {
				if (response.status === 503) {
					await redis().set(GBP.maintenance, true, { ex: 60 * 30 });
					throw new MaintenanceError();
				} else if (method !== "GET" && response.status === 403) {
					auth.token = await bangDream.refreshToken(version, auth);
					return bangDream.fetch(method, version, url, auth);
				}

				throw new AbortTaskRunError(
					`${method}: ${url.pathname} failed (${response.status})`,
				);
			}

			const bytes = await response.arrayBuffer().then(decrypt);
			span.setAttribute?.("size", bytes.byteLength);

			return { bytes, headers: response.headers };
		}),
};

const { decrypt, encrypt } = (() => {
	const { BANG_DREAM_AES_KEY, BANG_DREAM_AES_IV } = process.env;
	if (!BANG_DREAM_AES_KEY || !BANG_DREAM_AES_IV)
		throw new AbortTaskRunError("BanG Dream decryption keys are missing.");

	const key = Buffer.from(BANG_DREAM_AES_KEY);
	const iv = Buffer.from(BANG_DREAM_AES_IV);
	return {
		decrypt: (data: ArrayBuffer) => {
			const decipher = createDecipheriv("aes-128-cbc", key, iv);
			decipher.setAutoPadding(false);

			const plain = Buffer.concat([
				decipher.update(Buffer.from(data)),
				decipher.final(),
			]);

			const paddingLength = plain[plain.length - 1];
			return plain.subarray(0, plain.length - paddingLength);
		},
		encrypt: (data: ArrayBuffer) => {
			const padding = 16 - (data.byteLength % 16);
			const padded = Buffer.concat([
				Buffer.from(data),
				Buffer.alloc(padding, padding),
			]);

			const cipher = createCipheriv("aes-128-cbc", key, iv);
			cipher.setAutoPadding(false);

			return Buffer.concat([cipher.update(padded), cipher.final()]);
		},
	};
})();
