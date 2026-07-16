import { ImageResponse } from "takumi-js/response";

import stylesheet from "~/styles/global.css?inline";
import { SnapshotCard, type SnapshotCardProps } from "../_snapshot-card";

export const render = (props: SnapshotCardProps) =>
	new ImageResponse(
		<div class="bg-base-100 p-2">
			<SnapshotCard {...props} />
		</div>,
		{
			format: "png",
			devicePixelRatio: 2,
			stylesheets: [stylesheet],
			jsx: { tailwindClassesProperty: "class" },
		},
	);
