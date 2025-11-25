import { wait } from "@trigger.dev/sdk";
import { limitFunction } from "p-limit";

export const bestdori = limitFunction(
	async (path: string, query: Record<string, string>) => {
		const url = new URL(path, "https://bestdori.com/");
		url.search = new URLSearchParams(query).toString();

		await wait.for({ seconds: 5 + Math.random() });
		const response = await fetch(url);
		const contentType = response.headers.get("content-type") ?? "";
		if (!response.ok || !contentType.startsWith("application/json"))
			throw new Error(`Error fetching ${url.href} (${response.status})`);

		return response.json();
	},
	{ concurrency: 3 },
);
