import type { MatchInfo } from "minisearch";

export const filterTerms = (match: MatchInfo, key: string) =>
	Object.entries(match)
		.filter(([, fields]) => fields.includes(key))
		.map(([term]) => term);

export const highlight = (text: string, terms?: string[]) => {
	if (!terms?.length || !text) return text;
	const regex = new RegExp(`(${terms.join("|")})`, "gi");
	return [
		"<span>",
		...text
			.split(regex)
			.map((part, idx) =>
				idx % 2 === 1
					? `<mark class="bg-secondary text-secondary-content">${part}</mark>`
					: part,
			),
		"</span>",
	].join("");
};
