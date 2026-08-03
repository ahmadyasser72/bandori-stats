import type { APIContext } from "astro";

import z from "zod";

const pageSchema = z.coerce.number().positive().catch(1);

interface PaginateProps<T> {
	items:
		| T[]
		| {
				get: (
					limit: number,
					offset: number,
				) => Promise<T[] | { items: T[]; hasNextPage: boolean }>;
		  };
	context: APIContext;
	size: number;
	swap?: "outerHTML" | "after";
	params?: Record<string, string | number | boolean>;
	extraProps?: Record<string, string>;
}

export const paginate = async <T>({
	items,
	context,
	size,
	params,
	extraProps,
	swap = "outerHTML",
}: PaginateProps<T>) => {
	const current = pageSchema.parse(context.url.searchParams.get("page"));
	const offset = (current - 1) * size;

	const page = Array.isArray(items)
		? items.slice(offset, offset + size)
		: await items.get(size, offset);
	const isLastElement = (idx: number) => idx === size - 1;
	const out = {
		current,
		size,
		isLastElement,
		items: Array.isArray(page) ? page : page.items,
	};

	const hasNextPage = Array.isArray(items)
		? offset + size < items.length
		: Array.isArray(page)
			? page.length === size
			: page.hasNextPage;
	if (!hasNextPage) return { ...out, hasNextPage, props: {} };

	const url = new URL(context.url);
	url.search = "";
	url.searchParams.set("page", (current + 1).toString());
	return {
		...out,
		hasNextPage,
		props: {
			"hx-get": `${url.pathname}${url.search}`,
			"hx-trigger": "intersect once",
			"hx-swap": swap,
			...(params && { "hx-vals": JSON.stringify(params) }),
			...extraProps,
		},
	};
};
