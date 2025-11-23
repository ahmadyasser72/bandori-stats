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
	tailwindFunctions: ["clsx"],
	importOrder: [
		"^astro",
		"",
		"<THIRD_PARTY_MODULES>",
		"",
		"^@/(contents|scripts)/",
		"^~/(.*)$",
		"^[./]",
	],
};

export default config;
