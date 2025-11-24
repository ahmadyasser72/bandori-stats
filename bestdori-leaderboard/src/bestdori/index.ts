import { limitFunction } from "p-limit";

export const bestdori = limitFunction(
	async <T>(path: string, query: Record<string, string>): Promise<T> => {
		const url = new URL(path, "https://bestdori.com/");
		url.search = new URLSearchParams(query).toString();

		let failCounter = 0;
		while (true) {
			const response = await fetch(url);
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.startsWith("application/json")) {
				failCounter += 1;
				if (failCounter >= 5)
					throw new Error(`Error while fetching ${url.href}`);

				await new Promise((resolve) =>
					setTimeout(
						resolve,
						Math.pow(2, failCounter) * 1000 + Math.random() * 1500,
					),
				);
				continue;
			}

			return response.json();
		}
	},
	{ concurrency: 1 },
);
