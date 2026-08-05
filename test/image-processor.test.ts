import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	contentTypeForFormat,
	encodeImage,
	encodeImageToFile,
	isUnsupportedImageFormatError,
	readImageMetadata,
} from "../image-processor";

const FIXTURE = join(import.meta.dir, "../test-project/assets/img/logo.png");
const TMP = join(import.meta.dir, "../.fixtures-tmp");

afterAll(async () => {
	await rm(TMP, { recursive: true, force: true });
});

describe("readImageMetadata", () => {
	test("reads PNG dimensions", async () => {
		const meta = await readImageMetadata(FIXTURE);
		expect(meta.width).toBe(402);
		expect(meta.height).toBe(316);
		expect(meta.format).toBe("png");
	});
});

describe("encodeImage", () => {
	test("resizes and encodes to WebP", async () => {
		const bytes = await encodeImage(FIXTURE, {
			width: 160,
			format: "webp",
			quality: 80,
		});
		expect(bytes.byteLength).toBeGreaterThan(100);
		const meta = await readImageMetadata(bytes);
		// fit: "inside" may land 1px under the requested width for odd aspect ratios
		expect(meta.width).toBeGreaterThan(150);
		expect(meta.width).toBeLessThanOrEqual(160);
		expect(meta.format).toBe("webp");
	});

	test("encodes to JPEG", async () => {
		const bytes = await encodeImage(FIXTURE, {
			width: 120,
			format: "jpeg",
			quality: 75,
		});
		const meta = await readImageMetadata(bytes);
		expect(meta.width).toBeGreaterThan(110);
		expect(meta.width).toBeLessThanOrEqual(120);
		expect(meta.format).toBe("jpeg");
	});

	test("encodes to PNG", async () => {
		const bytes = await encodeImage(FIXTURE, {
			width: 80,
			format: "png",
			quality: 80,
		});
		const meta = await readImageMetadata(bytes);
		expect(meta.width).toBeGreaterThan(70);
		expect(meta.width).toBeLessThanOrEqual(80);
		expect(meta.format).toBe("png");
	});

	test("does not enlarge when withoutEnlargement applies", async () => {
		const bytes = await encodeImage(FIXTURE, {
			width: 2000,
			format: "webp",
			quality: 80,
		});
		const meta = await readImageMetadata(bytes);
		expect(meta.width).toBeLessThanOrEqual(402);
	});
});

describe("encodeImageToFile", () => {
	test("writes optimized file to disk", async () => {
		await mkdir(TMP, { recursive: true });
		const out = join(TMP, "logo-160w.webp");
		await encodeImageToFile(FIXTURE, out, {
			width: 160,
			format: "webp",
			quality: 80,
		});
		const file = Bun.file(out);
		expect(await file.exists()).toBe(true);
		expect(file.size).toBeGreaterThan(100);
		const meta = await readImageMetadata(out);
		expect(meta.width).toBeGreaterThan(150);
		expect(meta.width).toBeLessThanOrEqual(160);
	});
});

describe("contentTypeForFormat", () => {
	test("maps known formats", () => {
		expect(contentTypeForFormat("webp")).toBe("image/webp");
		expect(contentTypeForFormat("jpeg")).toBe("image/jpeg");
		expect(contentTypeForFormat("jpg")).toBe("image/jpeg");
		expect(contentTypeForFormat("png")).toBe("image/png");
		expect(contentTypeForFormat("avif")).toBe("image/avif");
	});
});

describe("isUnsupportedImageFormatError", () => {
	test("detects Bun format error codes", () => {
		expect(
			isUnsupportedImageFormatError({
				code: "ERR_IMAGE_FORMAT_UNSUPPORTED",
			}),
		).toBe(true);
		expect(
			isUnsupportedImageFormatError({ code: "ERR_IMAGE_UNKNOWN_FORMAT" }),
		).toBe(true);
		expect(isUnsupportedImageFormatError(new Error("nope"))).toBe(false);
		expect(isUnsupportedImageFormatError(null)).toBe(false);
	});
});
