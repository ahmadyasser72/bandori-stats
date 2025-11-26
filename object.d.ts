declare global {
	interface ObjectConstructor {
		fromEntries<K extends string, V>(e: [K, V][]): Record<K, V>;
	}
}

export {};
