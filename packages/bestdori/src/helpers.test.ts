import { describe, expect, test } from "bun:test";
import {
	accountHasNickname,
	compareValue,
	displayValue,
	formatNumber,
	getValue,
	sum,
	titleCase,
} from "./helpers";

describe("accountHasNickname", () => {
	test("returns false when nickname is null", () => {
		expect(accountHasNickname({ username: "foo", nickname: null })).toBeFalsy();
	});

	test("returns false when nickname is empty string", () => {
		expect(accountHasNickname({ username: "foo", nickname: "" })).toBeFalsy();
	});

	test("returns false when nickname equals username", () => {
		expect(accountHasNickname({ username: "foo", nickname: "foo" })).toBeFalse();
	});

	test("returns true when nickname differs from username", () => {
		expect(accountHasNickname({ username: "foo", nickname: "bar" })).toBeTrue();
	});
});

describe("getValue", () => {
	test("returns number as-is", () => {
		expect(getValue(42)).toBe(42);
	});

	test("returns array length", () => {
		expect(getValue([1, 2, 3])).toBe(3);
	});
});

describe("displayValue", () => {
	test('returns "N/A" for null', () => {
		expect(displayValue(null)).toBe("N/A");
	});

	test("returns string as-is", () => {
		expect(displayValue("hello")).toBe("hello");
	});

	test("formats a number", () => {
		expect(displayValue(1234)).toBe("1,234");
	});

	test("formats array length", () => {
		expect(displayValue([1, 2])).toBe("2");
	});
});

describe("compareValue", () => {
	test("returns 0 when both are null", () => {
		expect(compareValue(null, null)).toBe(0);
	});

	test("returns 0 when current is null", () => {
		expect(compareValue(null, 5)).toBe(0);
	});

	test("returns 0 when previous is null", () => {
		expect(compareValue(5, null)).toBe(0);
	});

	test("returns difference for numbers", () => {
		expect(compareValue(10, 3)).toBe(7);
	});

	test("works with arrays", () => {
		expect(compareValue([1, 2, 3], [1, 2])).toBe(1);
	});
});

describe("formatNumber", () => {
	test("formats with commas", () => {
		expect(formatNumber(1234567)).toBe("1,234,567");
	});

	test("compact notation for large numbers", () => {
		expect(formatNumber(150_000, { autoCompact: true })).toBe("150K");
	});

	test("no compact for small numbers", () => {
		expect(formatNumber(99_999, { autoCompact: true })).toBe("99,999");
	});

	test("adds positive sign", () => {
		expect(formatNumber(42, { positiveSign: true })).toBe("+42");
	});

	test("does not add sign for zero", () => {
		expect(formatNumber(0, { positiveSign: true })).toBe("0");
	});

	test("does not add sign for negatives", () => {
		expect(formatNumber(-5, { positiveSign: true })).toBe("-5");
	});
});

describe("sum", () => {
	test("adds all values", () => {
		expect(sum([1, 2, 3])).toBe(6);
	});

	test("returns 0 for empty array", () => {
		expect(sum([])).toBe(0);
	});
});

describe("titleCase", () => {
	test("splits camelCase and capitalizes each word", () => {
		expect(titleCase("fullComboCount")).toBe("Full Combo Count");
	});

	test("handles single word", () => {
		expect(titleCase("score")).toBe("Score");
	});

	test("handles empty string", () => {
		expect(titleCase("")).toBe("");
	});

	test("handles multiple consecutive uppercase", () => {
		expect(titleCase("allFullCombo")).toBe("All Full Combo");
	});
});
