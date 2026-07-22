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
		"^@bandori-stats/(.*)$",
		"",
		"<THIRD_PARTY_MODULES>",
		"",
		"^~/(.*)$",
		"^[./]",
	],

	tailwindStylesheet: "./site/src/styles/global.css",

	attributeGroups: [
		"^hx-(get|post)$",
		"^hx-(trigger|target|select|swap)(:inherited)?$",
		"$CODE_GUIDE",
		"^hx-",
	],
	attributeSort: "ASC",
};

export default config;
