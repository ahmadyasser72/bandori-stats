import { exec } from "node:child_process";
import { openAsBlob } from "node:fs";
import { access, constants, writeFile } from "node:fs/promises";
import path from "node:path";

import { limitAsync, retry } from "es-toolkit";

const GIT_ROOT_PATH = await new Promise<string>((resolve, reject) => {
	exec("git rev-parse --show-toplevel", (error, stdout) =>
		error ? reject(error) : resolve(stdout.trim()),
	);
}).catch((error) => {
	console.error("Failed getting git root directory:", error);
	return ".";
});

const BESTDORI_CACHE_DIR = path.join(GIT_ROOT_PATH, ".bestdori-cache");

export const fetchBestdori = limitAsync(
	async (pathname: string, cache: boolean): Promise<Response> => {
		const url = new URL(pathname, "https://bestdori.com");

		const cachePath = getCachePath(url.pathname);
		const cacheExists = cache && (await exists(cachePath));
		if (cacheExists) {
			const blob = await openAsBlob(cachePath);
			return new Response(blob);
		}

		const response = await retry(() => fetch(url), { retries: 5 });
		if (!isResponseOk(response)) {
			if (pathname.startsWith("/assets/en"))
				return fetchBestdori(
					pathname.replace("/assets/en", "/assets/jp"),
					cache,
				);
			else if (pathname.startsWith("/assets/jp"))
				return fetchBestdori(
					pathname.replace("/assets/jp", "/assets/cn"),
					cache,
				);

			throw new Error(`request to ${url.href} failed`);
		}

		if (cache) {
			const buffer = await response.clone().arrayBuffer().then(Buffer.from);
			await writeFile(cachePath, buffer);
		}

		return response;
	},
	4,
);

export const getCachePath = (target: string) =>
	path.join(BESTDORI_CACHE_DIR, target.replace(/^\//, "").replaceAll("/", "-"));

export const exists = async (path: string) => {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
};

const isResponseOk = (response: Response) => {
	if (!response.ok) return false;

	// bestdori doesn't return a 404 status on not found
	// so instead we check if we get their 404 page
	return response.headers.get("content-type") !== "text/html";
};
