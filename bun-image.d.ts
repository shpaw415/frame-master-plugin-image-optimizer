/**
 * Minimal typings for Bun.Image (runtime ≥1.3.14).
 * @types/bun may lag; this keeps the project type-checking until upstream catches up.
 *
 * Bun's global is `export import Bun = BunModule` from module "bun",
 * so we augment that module.
 */

declare module "bun" {
	interface ImageMetadata {
		width?: number;
		height?: number;
		format?: string;
		[key: string]: unknown;
	}

	interface ImageResizeOptions {
		fit?: "fill" | "inside";
		filter?: string;
		withoutEnlargement?: boolean;
	}

	interface ImageEncodeOptions {
		quality?: number;
		[key: string]: unknown;
	}

	type ImageInput =
		| string
		| ArrayBuffer
		| ArrayBufferView
		| Blob
		| BunFile
		| URL;

	class Image {
		constructor(input: ImageInput);
		readonly width: number;
		readonly height: number;
		metadata(): Promise<ImageMetadata>;
		resize(width: number, height?: number, options?: ImageResizeOptions): Image;
		rotate(degrees: 90 | 180 | 270): Image;
		flip(): Image;
		flop(): Image;
		modulate(options: { brightness?: number; saturation?: number }): Image;
		webp(options?: ImageEncodeOptions): Image;
		jpeg(options?: ImageEncodeOptions): Image;
		png(options?: ImageEncodeOptions): Image;
		avif(options?: ImageEncodeOptions): Image;
		heic(options?: ImageEncodeOptions): Image;
		bytes(): Promise<Uint8Array>;
		buffer(): Promise<ArrayBuffer>;
		blob(): Promise<Blob>;
		toBuffer(): Promise<Buffer>;
		toBase64(): Promise<string>;
		dataurl(): Promise<string>;
		placeholder(): Promise<string>;
		write(path: string): Promise<number>;

		static readonly backend: string;
		static fromClipboard?(): Image | null;
		static hasClipboardImage?: boolean;
		static clipboardChangeCount?: number;
	}
}
