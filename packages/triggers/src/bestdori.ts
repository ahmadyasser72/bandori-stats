import { queue } from "@trigger.dev/sdk";

import { limitAsync, retry } from "@bandori-stats/bestdori/helpers";

export const bestdori = limitAsync(
	async (path: string, query: Record<string, string>) => {
		const url = new URL(path, "https://bestdori.com/");
		url.search = new URLSearchParams(query).toString();

		const response = await retry(
			async () => {
				const response = await fetch(url);
				const contentType = response.headers.get("content-type") ?? "";
				if (!response.ok || !contentType.startsWith("application/json"))
					throw new Error(`Error fetching ${url.href} (${response.status})`);

				return response;
			},
			{ delay: (attempt) => attempt * 2500, retries: 4 },
		);

		return response.json();
	},
	4,
);

export const bestdoriQueue = queue({
	name: "bestdori-queue",
	concurrencyLimit: 4,
});
