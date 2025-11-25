import { logger, wait } from "@trigger.dev/sdk";
import { limitFunction } from "p-limit";

export const bestdori = limitFunction(
	async (path: string, query: Record<string, string>) => {
		const url = new URL(path, "https://bestdori.com/");
		url.search = new URLSearchParams(query).toString();

		await sleep();
		let failCounter = 0;
		while (true) {
			const response = await fetch(url);
			const contentType = response.headers.get("content-type") ?? "";
			if (!response.ok || !contentType.startsWith("application/json")) {
				failCounter += 1;
				if (failCounter > 6) {
					throw new Error(`Error while fetching ${url.href}`);
				}

				const content = await response.text();
				const status = response.status;
				logger.error("Error fetching bestdori", {
					counter: failCounter,
					url: url.href,
					status,
					content,
				});

				await sleep(Math.pow(2, failCounter));
				continue;
			}

			return response.json();
		}
	},
	{ concurrency: 2 },
);

const sleep = (duration?: number) =>
	wait.for({ seconds: 5 + (duration ?? 0) + Math.random() });
