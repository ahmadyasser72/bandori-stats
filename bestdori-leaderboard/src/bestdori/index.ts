import { limitFunction } from "p-limit";

let previousFailCounter = 0;
export const bestdori = limitFunction(
  async <T>(path: string, query: Record<string, string>): Promise<T> => {
    const url = new URL(path, "https://bestdori.com/");
    url.search = new URLSearchParams(query).toString();

    let failCounter = 0;
    await sleep(previousFailCounter * 1_000 + 3_000 + Math.random() * 1_000);
    while (true) {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("application/json")) {
        failCounter += 1;
        if (failCounter >= 5) {
          throw new Error(`Error while fetching ${url.href}`);
        }

        await sleep(
          Math.pow(2, failCounter) * 1_000 +
            Math.random() * failCounter * 1_000,
        );
        continue;
      }

      previousFailCounter = failCounter;
      return response.json();
    }
  },
  { concurrency: 1 },
);

const sleep = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));
