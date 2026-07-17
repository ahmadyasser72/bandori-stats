import type { APIContext } from "astro";
import { experimental_getFontFileURL, fontData } from "astro:assets";
import { ImageResponse } from "takumi-js/response";

import stylesheet from "~/styles/global.css?inline";
import { SnapshotCard, type SnapshotCardProps } from "../_snapshot-card";

export const render = async (context: APIContext, props: SnapshotCardProps) => {
	const fetchFont = async (name: string, key: keyof typeof fontData) => {
		const url = experimental_getFontFileURL(
			fontData[key][0].src[0].url,
			context.url,
		);
		const response = await fetch(url);

		return { name, data: await response.arrayBuffer() };
	};

	const fonts = await Promise.all([
		fetchFont("Cause", "--font-cause"),
		fetchFont("M PLUS Rounded 1c", "--font-m-plus-rounded-1c"),
	]);

	return new ImageResponse(
		<div class="bg-base-100 p-2" data-theme={context.locals.query.theme ?? ""}>
			<SnapshotCard {...props} context="takumi" />
		</div>,
		{
			format: "png",
			devicePixelRatio: 2,
			width: 772,
			stylesheets: [stylesheet],
			jsx: { tailwindClassesProperty: "class" },
			fonts,
		},
	);
};
