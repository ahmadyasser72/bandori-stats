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
		"prettier-plugin-packagejson",
		"prettier-plugin-astro",
		"@ianvs/prettier-plugin-sort-imports",
		"prettier-plugin-tailwindcss",
		"@xeonlink/prettier-plugin-organize-attributes",
	],

	overrides: [{ files: "*.astro", options: { parser: "astro" } }],

	importOrder: [
		"<BUILTIN_MODULES>",
		"",
		"^astro.*",
		"^cloudflare:workers$",
		"",
		"<THIRD_PARTY_MODULES>",
		"",
		"^@bandori-stats/.+",
		"^virtual:bandori-leaderboard$",
		"^~/.+",
		"^[.]",
	],

	tailwindStylesheet: "./site/src/styles/global.css",

	attributeGroups: [
		"^hx-(get|post|boost(:inherited)?)$",
		"^hx-",
		"^data-umami-event",
		"^(class|className|class:list)$",
		"$CODE_GUIDE",
	],
	attributeSort: "ASC",
};

export default config;
