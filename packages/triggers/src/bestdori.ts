import { queue } from "@trigger.dev/sdk";

export const bestdori = async (path: string, query: Record<string, string>) => {
	const url = new URL(path, "https://bestdori.com/");
	url.search = new URLSearchParams(query).toString();

	const response = await fetch(url);
	const contentType = response.headers.get("content-type") ?? "";
	if (!response.ok || !contentType.startsWith("application/json"))
		throw new Error(`Error fetching ${url.href} (${response.status})`);

	return response.json();
};

export const bestdoriQueue = queue({
	name: "bestdori-queue",
	concurrencyLimit: 4,
});
