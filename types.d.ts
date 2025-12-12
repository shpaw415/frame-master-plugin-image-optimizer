/**
 * Type declarations for image imports processed by frame-master-plugin-image-optimizer
 *
 * Usage: Add to your tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "types": ["frame-master-plugin-image-optimizer/types"]
 *   }
 * }
 */

/** Optimized image module returned when importing image files */
interface OptimizedImageModule {
  /** Get the URL for a specific size and format */
  src(size?: number, format?: string): string;
  /** Get srcset string for responsive images */
  srcset(format?: string): string;
  /** Get all available sources for <picture> element */
  sources(): Array<{ srcset: string; type: string }>;
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Available widths */
  sizes: number[];
  /** Available formats (e.g., ["webp", "avif"]) */
  formats: string[];
  /** Original file path relative to input directory */
  original: string;
}

declare module "*.jpg" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.jpeg" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.png" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.gif" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.webp" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.avif" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.tiff" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}

declare module "*.svg" {
  const image: OptimizedImageModule;
  export default image;
  export const src: OptimizedImageModule["src"];
  export const srcset: OptimizedImageModule["srcset"];
  export const sources: OptimizedImageModule["sources"];
  export const width: number;
  export const height: number;
  export const sizes: number[];
  export const formats: string[];
  export const original: string;
}
