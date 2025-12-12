/**
 * Client-side utilities for frame-master-plugin-image-optimizer
 * Import these helpers to build optimized image URLs in a type-safe way
 */

// ===== Types =====

export type ImageFormat = "webp" | "avif" | "jpeg" | "jpg" | "png";

export interface OptimizeOptions {
  /** Target width in pixels */
  width?: number;
  /** Output format */
  format?: ImageFormat;
  /** Quality (1-100) */
  quality?: number;
}

export interface OnTheFlyOptions extends OptimizeOptions {
  /** Public path prefix (default: "/optimized") */
  publicPath?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface OnTheFlyResult {
  /** The optimized image as a Blob */
  blob: Blob;
  /** Content type of the image */
  contentType: string;
  /** Whether the image was optimized on-the-fly or served from cache */
  optimizedOnTheFly: boolean;
  /** Object URL for use in img.src (remember to revoke!) */
  objectUrl: string;
  /** Revoke the object URL when done */
  revoke: () => void;
}

export interface ImageUrlBuilderConfig {
  /** Public path prefix (default: "/optimized") */
  publicPath?: string;
  /** Default format when not specified */
  defaultFormat?: ImageFormat;
  /** Default quality when not specified */
  defaultQuality?: number;
}

export interface ResponsiveImageResult {
  /** Default src URL (largest size) */
  src: string;
  /** Srcset string for responsive images */
  srcset: string;
  /** Sizes attribute suggestion */
  sizes: string;
}

// ===== On-The-Fly Optimization API =====

/**
 * Fetch an optimized image on-the-fly from the server
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await fetchOptimized("hero.jpg", { width: 640, format: "webp" });
 * img.src = result.objectUrl;
 *
 * // Don't forget to revoke when done!
 * result.revoke();
 *
 * // With quality
 * const result = await fetchOptimized("photo.png", {
 *   width: 800,
 *   format: "avif",
 *   quality: 90
 * });
 * ```
 */
export async function fetchOptimized(
  imagePath: string,
  options: OnTheFlyOptions = {}
): Promise<OnTheFlyResult> {
  const { publicPath = "/optimized", signal, ...opts } = options;

  const url = buildOptimizeUrl(imagePath, { publicPath, ...opts });

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch optimized image: ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob();
  const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
  const optimizedOnTheFly =
    response.headers.get("X-Image-Optimized") === "on-the-fly";
  const objectUrl = URL.createObjectURL(blob);

  return {
    blob,
    contentType,
    optimizedOnTheFly,
    objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

/**
 * Fetch an optimized image and return as a data URL (base64)
 *
 * @example
 * ```ts
 * const dataUrl = await fetchOptimizedAsDataUrl("hero.jpg", { width: 640, format: "webp" });
 * img.src = dataUrl; // No need to revoke
 * ```
 */
export async function fetchOptimizedAsDataUrl(
  imagePath: string,
  options: OnTheFlyOptions = {}
): Promise<string> {
  const result = await fetchOptimized(imagePath, options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      result.revoke();
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      result.revoke();
      reject(new Error("Failed to convert to data URL"));
    };
    reader.readAsDataURL(result.blob);
  });
}

/**
 * Preload an optimized image into the browser cache
 *
 * @example
 * ```ts
 * // Preload images before they're needed
 * await preloadOptimized("hero.jpg", { width: 1280, format: "webp" });
 * await preloadOptimized("banner.jpg", { width: 1920, format: "avif" });
 * ```
 */
export async function preloadOptimized(
  imagePath: string,
  options: OnTheFlyOptions = {}
): Promise<void> {
  const result = await fetchOptimized(imagePath, options);
  result.revoke(); // Clean up immediately, image is now in browser cache
}

/**
 * Preload multiple optimized images in parallel
 *
 * @example
 * ```ts
 * await preloadOptimizedBatch([
 *   { path: "hero.jpg", width: 1280, format: "webp" },
 *   { path: "banner.jpg", width: 1920, format: "webp" },
 *   { path: "thumbnail.jpg", width: 320, format: "webp" },
 * ]);
 * ```
 */
export async function preloadOptimizedBatch(
  images: Array<{ path: string } & OptimizeOptions>,
  options: { publicPath?: string; concurrency?: number } = {}
): Promise<void> {
  const { publicPath, concurrency = 4 } = options;

  // Process in batches for controlled concurrency
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    await Promise.all(
      batch.map((img) =>
        preloadOptimized(img.path, {
          publicPath,
          width: img.width,
          format: img.format,
          quality: img.quality,
        })
      )
    );
  }
}

/**
 * Build the URL for on-the-fly optimization (without fetching)
 *
 * @example
 * ```ts
 * const url = buildOptimizeUrl("hero.jpg", { width: 640, format: "webp" });
 * // => "/optimized/hero.jpg?w=640&format=webp"
 * ```
 */
export function buildOptimizeUrl(
  imagePath: string,
  options: OnTheFlyOptions = {}
): string {
  const { publicPath = "/optimized", width, format, quality } = options;

  const params = new URLSearchParams();
  if (width !== undefined) params.set("w", width.toString());
  if (format !== undefined) params.set("format", format);
  if (quality !== undefined) params.set("q", quality.toString());

  const basePath = `${publicPath}/${imagePath}`.replace(/\/+/g, "/");
  const queryString = params.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Build URL for a pre-processed variant
 *
 * @example
 * ```ts
 * const url = buildVariantUrl("hero", 640, "webp");
 * // => "/optimized/hero-640w.webp"
 * ```
 */
export function buildVariantUrl(
  baseName: string,
  width: number,
  format: ImageFormat = "webp",
  publicPath: string = "/optimized"
): string {
  return `${publicPath}/${baseName}-${width}w.${format}`.replace(/\/+/g, "/");
}
