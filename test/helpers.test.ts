import { describe, expect, test } from "bun:test";
import {
	getOptimalSrc,
	getPictureSources,
	getSrcSet,
	type ImageManifest,
} from "../index";
import { buildOptimizeUrl, buildVariantUrl } from "../utils";

const manifest: ImageManifest = {
	generatedAt: "2026-01-01T00:00:00.000Z",
	images: {
		"hero.jpg": {
			original: "hero.jpg",
			width: 1920,
			height: 1080,
			variants: [
				{
					format: "webp",
					size: 320,
					path: "hero-320w.webp",
					width: 320,
					height: 180,
				},
				{
					format: "webp",
					size: 640,
					path: "hero-640w.webp",
					width: 640,
					height: 360,
				},
				{
					format: "avif",
					size: 320,
					path: "hero-320w.avif",
					width: 320,
					height: 180,
				},
			],
		},
	},
};

describe("getSrcSet", () => {
	test("builds webp srcset", () => {
		const srcset = getSrcSet(manifest, "hero.jpg", "webp");
		expect(srcset).toContain("hero-320w.webp 320w");
		expect(srcset).toContain("hero-640w.webp 640w");
		expect(srcset).not.toContain("avif");
	});

	test("returns empty string for unknown image", () => {
		expect(getSrcSet(manifest, "missing.jpg")).toBe("");
	});
});

describe("getOptimalSrc", () => {
	test("picks smallest variant >= target width", () => {
		expect(getOptimalSrc(manifest, "hero.jpg", 400, "webp")).toBe(
			"hero-640w.webp",
		);
		expect(getOptimalSrc(manifest, "hero.jpg", 100, "webp")).toBe(
			"hero-320w.webp",
		);
	});

	test("returns null for missing image", () => {
		expect(getOptimalSrc(manifest, "nope.jpg", 100)).toBeNull();
	});
});

describe("getPictureSources", () => {
	test("groups by format", () => {
		const sources = getPictureSources(manifest, "hero.jpg");
		expect(sources.length).toBe(2);
		const types = sources.map((s) => s.type).sort();
		expect(types).toEqual(["image/avif", "image/webp"]);
	});
});

describe("utils URL builders", () => {
	test("buildOptimizeUrl", () => {
		expect(
			buildOptimizeUrl("hero.jpg", {
				width: 640,
				format: "webp",
				quality: 85,
			}),
		).toBe("/optimized/hero.jpg?w=640&format=webp&q=85");
	});

	test("buildVariantUrl", () => {
		expect(buildVariantUrl("hero", 640, "webp")).toBe(
			"/optimized/hero-640w.webp",
		);
	});
});
