const numberFormatter = Intl.NumberFormat("en-US");
const numberFormatterCompact = Intl.NumberFormat("en-US", {
	notation: "compact",
});
export const formatNumber = (n: number, autoCompact = false) =>
	(autoCompact && n >= 100_000
		? numberFormatterCompact
		: numberFormatter
	).format(n);

export const sum = (values: number[]) =>
	values.reduce((acc, next) => acc + next, 0);
