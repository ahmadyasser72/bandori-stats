/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
	trailingComma: "all",
	semi: true,
	singleQuote: false,
	useTabs: true,

	plugins: [
		"prettier-plugin-astro",
		"@ianvs/prettier-plugin-sort-imports",
		"prettier-plugin-tailwindcss",
	],
	overrides: [{ files: "*.astro", options: { parser: "astro" } }],
	importOrder: ["^astro", "", "<THIRD_PARTY_MODULES>", "", "^~/(.*)$", "^[./]"],
};

export default config;
