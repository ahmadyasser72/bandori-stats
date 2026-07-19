declare namespace App {
	interface Locals {
		parseQuery: <S extends import("zod").ZodObject>(
			schema: S,
		) => import("zod").output<S>;
	}
}
