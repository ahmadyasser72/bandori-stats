import type { APIContext } from "astro";
import z from "zod";

const pageSchema = z.coerce.number().positive().catch(1);

interface PaginateProps<T> {
	items:
		| T[]
		| {
				get: (limit: number, offset: number) => Promise<T>;
				hasNextPage: (limit: number, offset: number, it: T) => boolean;
		  };
	context: APIContext;
	size: number;
	extraProps: Record<string, string>;
}

export const paginate = async <T>({
	items,
	context,
	size,
	extraProps,
}: PaginateProps<T>) => {
	const current = pageSchema.parse(context.url.searchParams.get("page"));
	const offset = (current - 1) * size;

	const pageItems = Array.isArray(items)
		? items.slice(offset, offset + size)
		: [await items.get(size, offset)];
	const isLastElement = (idx: number) => idx === size - 1;
	const out = { current, size, isLastElement, items: pageItems };

	const hasNextPage = Array.isArray(items)
		? offset + size < items.length
		: items.hasNextPage(size, offset, pageItems[0]);
	if (!hasNextPage) return { ...out, props: {} };

	const url = new URL(context.url);
	url.search = "";
	url.searchParams.set("page", (current + 1).toString());
	return {
		...out,
		props: {
			"hx-get": url.href,
			"hx-trigger": "intersect once",
			...extraProps,
		},
	};
};
