const numberFormatter = Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => numberFormatter.format(n);

export const sum = (values: number[]) =>
	values.reduce((acc, next) => acc + next, 0);
