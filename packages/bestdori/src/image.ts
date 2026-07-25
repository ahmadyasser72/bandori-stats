import Vips from "wasm-vips";

export const vips = await Vips();
export const imageConfig = {
	effort: import.meta.env.DEV ? 1 : 6,
	Q: 67,
	compression: "av1",
};
