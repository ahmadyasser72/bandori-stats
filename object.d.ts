declare global {
	interface ObjectConstructor {
		keys<K extends string, V>(o: Record<K, V>): K[];
		entries<K extends string, V>(o: Record<K, V>): [K, V][];
		fromEntries<K extends string, V>(e: [K, V][]): Record<K, V>;
	}
}

export {};
