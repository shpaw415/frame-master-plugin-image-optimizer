import { describe, expect, test } from "bun:test";
import {
	isPathInsideDir,
	matchInputDir,
	normalizeInputDirs,
	normalizePosix,
	recordSource,
	relativeFromInput,
	toAbsoluteInputDirs,
} from "../input-dirs";

describe("normalizeInputDirs", () => {
	test("wraps a single string", () => {
		expect(normalizeInputDirs("src/images")).toEqual(["src/images"]);
	});

	test("keeps array order and trims trailing slashes", () => {
		expect(normalizeInputDirs(["src/images/", "assets/photos"])).toEqual([
			"src/images",
			"assets/photos",
		]);
	});

	test("dedupes and drops empty entries", () => {
		expect(
			normalizeInputDirs([" src/images ", "src/images/", "", "assets/photos"]),
		).toEqual(["src/images", "assets/photos"]);
	});

	test("returns empty for empty array", () => {
		expect(normalizeInputDirs([])).toEqual([]);
	});
});

describe("matchInputDir", () => {
	const dirs = ["/proj/src/images", "/proj/assets/photos"];

	test("matches the containing root", () => {
		expect(matchInputDir("/proj/src/images/hero.jpg", dirs)).toBe(
			"/proj/src/images",
		);
	});

	test("uses longest prefix for overlapping roots", () => {
		expect(
			matchInputDir("/proj/src/images/hero.jpg", [
				"/proj/src",
				"/proj/src/images",
			]),
		).toBe("/proj/src/images");
	});

	test("does not match a prefix sibling directory", () => {
		expect(
			matchInputDir("/proj/src/images-backup/hero.jpg", ["/proj/src/images"]),
		).toBeNull();
	});

	test("returns null when no root matches", () => {
		expect(matchInputDir("/proj/other/hero.jpg", dirs)).toBeNull();
	});
});

describe("relativeFromInput", () => {
	test("strips the matched root", () => {
		expect(
			relativeFromInput("/proj/src/images/blog/hero.jpg", "/proj/src/images"),
		).toBe("blog/hero.jpg");
	});
});

describe("isPathInsideDir", () => {
	test("accepts files inside the directory", () => {
		expect(
			isPathInsideDir("/proj/src/images/hero.jpg", "/proj/src/images"),
		).toBe(true);
	});

	test("rejects sibling paths that share a prefix", () => {
		expect(
			isPathInsideDir("/proj/src/images-backup/hero.jpg", "/proj/src/images"),
		).toBe(false);
	});
});

describe("toAbsoluteInputDirs", () => {
	test("joins relative roots onto cwd", () => {
		expect(
			toAbsoluteInputDirs(["src/images", "assets/photos"], "/proj"),
		).toEqual(["/proj/src/images", "/proj/assets/photos"]);
	});
});

describe("recordSource", () => {
	test("keeps the first root on relative-path clash", () => {
		const seen = new Map<string, string>();
		expect(recordSource("hero.jpg", "/proj/src/images", seen)).toBe("added");
		expect(recordSource("hero.jpg", "/proj/assets/photos", seen)).toBe("clash");
		expect(seen.get("hero.jpg")).toBe("/proj/src/images");
	});

	test("treats the same root as duplicate", () => {
		const seen = new Map<string, string>();
		expect(recordSource("hero.jpg", "/proj/src/images", seen)).toBe("added");
		expect(recordSource("hero.jpg", "/proj/src/images/", seen)).toBe(
			"duplicate",
		);
	});
});

describe("normalizePosix", () => {
	test("converts backslashes and strips trailing slashes", () => {
		expect(normalizePosix("src\\images\\")).toBe("src/images");
	});
});
