import { exec } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import { limitAsync } from "es-toolkit";

export const GIT_ROOT_PATH = await new Promise<string>((resolve, reject) => {
	exec("git rev-parse --show-toplevel", (error, stdout) =>
		error ? reject(error) : resolve(stdout.trim()),
	);
}).catch((error) => {
	console.error("Failed getting git root directory:", error);
	return ".";
});

const BESTDORI_CACHE_DIR = joinPath(GIT_ROOT_PATH, ".bestdori-cache");

export const fetchBestdori = limitAsync(
	async (pathname: string, cache: boolean): Promise<Response> => {
		const url = new URL(pathname, "https://bestdori.com");

		const cachePath = getCachePath(url);
		if (cache && existsSync(cachePath)) {
			const cached = readFileSync(cachePath);
			return new Response(cached);
		}

		const response = await fetch(url);
		if (!isResponseOk(response)) {
			if (pathname.startsWith("/assets/en"))
				return fetchBestdori(
					pathname.replace("/assets/en", "/assets/jp"),
					cache,
				);

			throw new Error(`request to ${url.href} failed`);
		}

		if (cache && shouldPutCache(cachePath, response)) {
			const buffer = await response.clone().arrayBuffer().then(Buffer.from);
			writeFileSync(cachePath, buffer);
		}

		return response;
	},
	4,
);

const getCachePath = (url: URL) => {
	const filename = url.pathname.slice(1).replaceAll("/", "-");
	const path = joinPath(BESTDORI_CACHE_DIR, filename);

	return path;
};

const isResponseOk = (response: Response) => {
	if (!response.ok) return false;

	// bestdori doesn't return a 404 status on not found
	// so instead we check if we get their 404 page
	return response.headers.get("content-type") !== "text/html";
};

const shouldPutCache = (path: string, response: Response) => {
	if (!existsSync(path)) return true;

	const fileSize = statSync(path).size.toString();
	const responseSize = response.headers.get("content-length");
	return fileSize !== responseSize;
};
