/**
 * Image processing via Bun.Image (built into Bun ≥1.3.14).
 * Zero npm native addons — replaces sharp.
 */

export type OutputFormat = "webp" | "avif" | "png" | "jpeg";

export interface ImageMetadata {
	width: number;
	height: number;
	format?: string;
}

export interface EncodeOptions {
	/** Target width in pixels */
	width: number;
	/** Optional target height; when omitted, aspect ratio is preserved */
	height?: number;
	/** Output format */
	format: OutputFormat | string;
	/** Quality 1–100 */
	quality: number;
}

/**
 * Read image dimensions / format without fully decoding when possible.
 */
export async function readImageMetadata(
	input: string | ArrayBuffer | Uint8Array | Blob,
): Promise<ImageMetadata> {
	const meta = await new Bun.Image(input).metadata();
	return {
		width: meta.width ?? 0,
		height: meta.height ?? 0,
		format: meta.format,
	};
}

/** Chainable Bun.Image instance (runtime type; may lag in @types/bun). */
type ImagePipeline = InstanceType<typeof Bun.Image>;

/**
 * Apply format-specific encode options on a Bun.Image pipeline.
 * Returns a new pipeline (chainable); does not run until a terminal method.
 */
function applyFormat(
	pipeline: ImagePipeline,
	format: string,
	quality: number,
): ImagePipeline {
	switch (format) {
		case "webp":
			return pipeline.webp({ quality });
		case "avif":
			return pipeline.avif({ quality });
		case "jpeg":
		case "jpg":
			return pipeline.jpeg({ quality });
		case "png":
			return pipeline.png({ quality });
		default:
			// Leave as-is; terminal methods still work if format is already set
			return pipeline;
	}
}

/**
 * Resize and encode an image, returning raw bytes.
 */
export async function encodeImage(
	input: string | ArrayBuffer | Uint8Array | Blob,
	options: EncodeOptions,
): Promise<Uint8Array> {
	const { width, height, format, quality } = options;

	let pipeline = new Bun.Image(input).resize(width, height, {
		fit: "inside",
		withoutEnlargement: true,
	});

	pipeline = applyFormat(pipeline, format, quality);
	return await pipeline.bytes();
}

/**
 * Resize and encode an image, writing directly to disk.
 */
export async function encodeImageToFile(
	input: string | ArrayBuffer | Uint8Array | Blob,
	outputPath: string,
	options: EncodeOptions,
): Promise<void> {
	const { width, height, format, quality } = options;

	let pipeline = new Bun.Image(input).resize(width, height, {
		fit: "inside",
		withoutEnlargement: true,
	});

	pipeline = applyFormat(pipeline, format, quality);
	await pipeline.write(outputPath);
}

/**
 * MIME type for a known output format.
 */
export function contentTypeForFormat(format: string): string {
	switch (format) {
		case "webp":
			return "image/webp";
		case "avif":
			return "image/avif";
		case "png":
			return "image/png";
		case "jpeg":
		case "jpg":
			return "image/jpeg";
		default:
			return `image/${format}`;
	}
}

/**
 * Whether an error is "format not supported on this platform"
 * (e.g. AVIF encode on Linux).
 */
export function isUnsupportedImageFormatError(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: string }).code;
	return (
		code === "ERR_IMAGE_FORMAT_UNSUPPORTED" ||
		code === "ERR_IMAGE_UNKNOWN_FORMAT"
	);
}
