# frame-master-plugin-image-optimizer

A powerful image optimization plugin for [Frame-Master](https://frame-master.com) that automatically generates responsive, optimized images in multiple formats and sizes. Import images directly in your code and get a utility object with smart `src`, `srcset`, and `sources` helpers.

## Features

- 🖼️ **Multi-format output** - Generate WebP, AVIF, JPEG, and PNG variants
- 📐 **Responsive sizes** - Automatically create multiple sizes for responsive images
- 🔄 **Smart imports** - Import images as JS modules with utility methods
- ⚡ **On-the-fly optimization** - API endpoint for dynamic image optimization
- 👀 **Dev mode watching** - Auto-reprocess on file changes
- 📄 **Manifest generation** - JSON manifest for advanced use cases
- ⚡ **Build integration** - Seamless integration with Frame-Master's build system
- 🛠️ **CLI commands** - Manual processing and cleanup commands
- 🎯 **TypeScript support** - Full type definitions included

## Installation

```bash
bun add frame-master-plugin-image-optimizer sharp
```

> **Note:** This plugin requires [sharp](https://sharp.pixelplumbing.com/) for image processing.

## Quick Start

```typescript
// frame-master.config.ts
import type { FrameMasterConfig } from "frame-master/server/types";
import ImageOptimizerPlugin from "frame-master-plugin-image-optimizer";

const config: FrameMasterConfig = {
  HTTPServer: { port: 3000 },
  plugins: [
    ImageOptimizerPlugin({
      input: "src/images",
      output: "static/optimized",
      formats: ["webp", "avif"],
      sizes: [320, 640, 1280, 1920],
    }),
  ],
};

export default config;
```

## Configuration Options

| Option             | Type                                      | Default              | Description                                                   |
| ------------------ | ----------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `input`            | `string`                                  | **required**         | Directory containing source images (relative to project root) |
| `output`           | `string`                                  | `"static/optimized"` | Output directory for optimized images                         |
| `publicPath`       | `string`                                  | `"/optimized"`       | Public URL prefix for serving images                          |
| `formats`          | `("webp" \| "avif" \| "png" \| "jpeg")[]` | `["webp"]`           | Output formats to generate                                    |
| `sizes`            | `number[]`                                | `[320, 640, 1280]`   | Widths (in pixels) to generate                                |
| `quality`          | `number`                                  | `80`                 | Compression quality (1-100)                                   |
| `watch`            | `boolean`                                 | `true`               | Enable file watching in dev mode                              |
| `generateManifest` | `boolean`                                 | `true`               | Generate a manifest.json file                                 |
| `keepOriginal`     | `boolean`                                 | `false`              | Copy original images to output                                |
| `skipExisting`     | `boolean`                                 | `true`               | Skip processing if output exists                              |
| `verbose`          | `boolean`                                 | `false`              | Enable detailed logging                                       |
| `enableImports`    | `boolean`                                 | `true`               | Enable importing images as JS modules                         |

### Example: Full Configuration

```typescript
ImageOptimizerPlugin({
  input: "src/assets/images",
  output: "static/img",
  publicPath: "/img",
  formats: ["webp", "avif", "jpeg"],
  sizes: [320, 640, 960, 1280, 1920],
  quality: 85,
  watch: true,
  generateManifest: true,
  keepOriginal: true,
  skipExisting: true,
  verbose: false,
  enableImports: true,
});
```

## Usage

### Importing Images (Recommended)

The plugin transforms image imports into JavaScript modules with utility methods:

```typescript
import heroImage from "./src/images/hero.jpg";

// Get URL for specific size and format
heroImage.src(640, "webp"); // "/optimized/hero-640w.webp"
heroImage.src(1280, "avif"); // "/optimized/hero-1280w.avif"
heroImage.src(); // Largest available size

// Get srcset for responsive images
heroImage.srcset("webp"); // "hero-320w.webp 320w, hero-640w.webp 640w, ..."

// Get sources for <picture> element
heroImage.sources();
// [{ srcset: "...", type: "image/webp" }, { srcset: "...", type: "image/avif" }]

// Access metadata
heroImage.width; // 1920 (original width)
heroImage.height; // 1080 (original height)
heroImage.sizes; // [320, 640, 1280, 1920]
heroImage.formats; // ["webp", "avif"]
heroImage.original; // "hero.jpg"
```

### Named Exports

You can also use named exports:

```typescript
import { src, srcset, width, height } from "./src/images/hero.jpg";

const url = src(640);
const responsiveSrc = srcset("webp");
```

### React/JSX Example

```tsx
import heroImage from "./images/hero.jpg";

function Hero() {
  return (
    <picture>
      {heroImage.sources().map(({ srcset, type }) => (
        <source key={type} srcSet={srcset} type={type} sizes="100vw" />
      ))}
      <img
        src={heroImage.src(1280)}
        width={heroImage.width}
        height={heroImage.height}
        alt="Hero image"
        loading="lazy"
      />
    </picture>
  );
}
```

### Responsive Image with srcset

```tsx
import productImage from "./images/product.jpg";

function ProductCard() {
  return (
    <img
      src={productImage.src(640)}
      srcSet={productImage.srcset("webp")}
      sizes="(max-width: 640px) 100vw, 640px"
      width={productImage.width}
      height={productImage.height}
      alt="Product"
    />
  );
}
```

## TypeScript Setup

Add the type definitions to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["frame-master-plugin-image-optimizer/types"]
  }
}
```

This provides full type support for image imports:

```typescript
import img from "./photo.jpg";
//     ^? OptimizedImageModule

img.src(640); // (size?: number, format?: string) => string
img.srcset(); // (format?: string) => string
img.sources(); // () => Array<{ srcset: string; type: string }>
img.width; // number
img.height; // number
```

## CLI Commands

The plugin extends Frame-Master's CLI with image management commands:

```bash
# Process all images manually
frame-master extended-cli images --process

# Clean the output directory
frame-master extended-cli images --clean

# Regenerate manifest only
frame-master extended-cli images --manifest

# Enable verbose output
frame-master extended-cli images --process --verbose
```

## Manifest File

When `generateManifest` is enabled, the plugin creates a `manifest.json` in the output directory:

```json
{
  "generatedAt": "2025-12-11T10:30:00.000Z",
  "images": {
    "hero.jpg": {
      "original": "hero.jpg",
      "width": 1920,
      "height": 1080,
      "variants": [
        {
          "format": "webp",
          "size": 320,
          "path": "hero-320w.webp",
          "width": 320,
          "height": 180
        },
        {
          "format": "webp",
          "size": 640,
          "path": "hero-640w.webp",
          "width": 640,
          "height": 360
        }
      ]
    }
  }
}
```

### Using the Manifest Directly

For advanced use cases, you can use the manifest with helper functions:

```typescript
import {
  getSrcSet,
  getOptimalSrc,
  getPictureSources,
} from "frame-master-plugin-image-optimizer";
import manifest from "./static/optimized/manifest.json";

// Get srcset string
getSrcSet(manifest, "hero.jpg", "webp");

// Get optimal source for a target width
getOptimalSrc(manifest, "hero.jpg", 800, "webp");

// Get picture sources
getPictureSources(manifest, "hero.jpg");
```

## On-The-Fly Image Optimization

The plugin exposes an API endpoint that can optimize images on-demand. This is useful for:

- Dynamic images that aren't known at build time
- User-uploaded content
- Images from external sources
- Generating specific sizes/formats on request

### API Endpoint

```
GET /{publicPath}/{imagePath}?w={width}&format={format}&q={quality}
```

**Query Parameters:**

| Parameter | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `w`       | `number` | Target width in pixels           |
| `format`  | `string` | Output format (webp, avif, jpeg) |
| `q`       | `number` | Quality (1-100)                  |

**Examples:**

```bash
# Get image at 800px width as WebP
/optimized/hero.jpg?w=800&format=webp

# Get image as AVIF with quality 90
/optimized/photos/landscape.png?format=avif&q=90

# Just resize, keep original format
/optimized/product.jpg?w=400
```

**Response Headers:**

- `X-Image-Optimized: on-the-fly` - When the image was optimized on-demand
- `X-Image-Optimized: pre-processed` - When serving a pre-built variant

### Client-Side Helpers

Import type-safe utilities from `frame-master-plugin-image-optimizer/utils`:

```typescript
import {
  fetchOptimized,
  fetchOptimizedAsDataUrl,
  preloadOptimized,
  preloadOptimizedBatch,
  buildOptimizeUrl,
  buildVariantUrl,
} from "frame-master-plugin-image-optimizer/utils";
```

#### `fetchOptimized(imagePath, options)`

Fetch an optimized image and get a Blob with an Object URL:

```typescript
const result = await fetchOptimized("hero.jpg", {
  width: 640,
  format: "webp",
  quality: 85,
});

// Use the object URL
img.src = result.objectUrl;

// Access metadata
console.log(result.contentType); // "image/webp"
console.log(result.optimizedOnTheFly); // true/false

// IMPORTANT: Revoke when done to free memory
result.revoke();
```

#### `fetchOptimizedAsDataUrl(imagePath, options)`

Get the optimized image as a base64 data URL (no need to revoke):

```typescript
const dataUrl = await fetchOptimizedAsDataUrl("hero.jpg", {
  width: 640,
  format: "webp",
});

img.src = dataUrl; // data:image/webp;base64,...
```

#### `preloadOptimized(imagePath, options)`

Preload an image into the browser cache:

```typescript
// Preload before navigation
await preloadOptimized("hero.jpg", { width: 1280, format: "webp" });
await preloadOptimized("banner.jpg", { width: 1920, format: "avif" });
```

#### `preloadOptimizedBatch(images, options)`

Preload multiple images with controlled concurrency:

```typescript
await preloadOptimizedBatch(
  [
    { path: "hero.jpg", width: 1280, format: "webp" },
    { path: "banner.jpg", width: 1920, format: "webp" },
    { path: "thumb1.jpg", width: 320, format: "webp" },
    { path: "thumb2.jpg", width: 320, format: "webp" },
  ],
  { concurrency: 4 } // Process 4 at a time
);
```

#### `buildOptimizeUrl(imagePath, options)`

Build the URL without fetching (for use in `<img src>`):

```typescript
const url = buildOptimizeUrl("hero.jpg", {
  width: 640,
  format: "webp",
  quality: 85,
});
// => "/optimized/hero.jpg?w=640&format=webp&q=85"
```

#### `buildVariantUrl(baseName, width, format, publicPath)`

Build URL for a pre-processed variant:

```typescript
const url = buildVariantUrl("hero", 640, "webp");
// => "/optimized/hero-640w.webp"
```

### React Example with On-The-Fly Optimization

```tsx
import { useState, useEffect } from "react";
import { fetchOptimized } from "frame-master-plugin-image-optimizer/utils";

function DynamicImage({ path, width, format = "webp" }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let result;

    fetchOptimized(path, { width, format })
      .then((r) => {
        result = r;
        setSrc(r.objectUrl);
      })
      .catch(console.error);

    return () => result?.revoke();
  }, [path, width, format]);

  return src ? <img src={src} alt="" /> : <div>Loading...</div>;
}

// Usage
<DynamicImage path="user-uploads/avatar.jpg" width={200} format="webp" />;
```

### Server-Side Usage

You can also call the optimizer directly on the server:

```typescript
import { optimizeOnTheFly } from "frame-master-plugin-image-optimizer";

// In a custom route handler
const result = await optimizeOnTheFly(imagePath, {
  width: 800,
  format: "webp",
  quality: 85,
});

if (result) {
  return new Response(result.data, {
    headers: {
      "Content-Type": result.contentType,
      "X-Image-Optimized": result.wasOptimized ? "on-the-fly" : "pre-processed",
    },
  });
}
```

## Output Structure

Given this input:

```
src/images/
├── hero.jpg
├── products/
│   └── item.png
└── blog/
    └── post-cover.jpg
```

The plugin generates:

```
static/optimized/
├── manifest.json
├── hero-320w.webp
├── hero-640w.webp
├── hero-1280w.webp
├── products/
│   ├── item-320w.webp
│   ├── item-640w.webp
│   └── item-1280w.webp
└── blog/
    ├── post-cover-320w.webp
    ├── post-cover-640w.webp
    └── post-cover-1280w.webp
```

## Supported Formats

### Input Formats

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)
- AVIF (`.avif`)
- TIFF (`.tiff`)
- SVG (`.svg`)

### Output Formats

- **WebP** - Best overall compression, wide browser support
- **AVIF** - Superior compression, growing browser support
- **JPEG** - Universal compatibility, uses MozJPEG encoder
- **PNG** - Lossless, best for graphics with transparency

## How It Works

### Lifecycle

1. **Server Start (`main`)** - Processes all images in the input directory
2. **Dev Mode (`dev_main`)** - Enables file watching if configured
3. **File Change** - Debounced reprocessing of changed files (300ms)
4. **Build (`beforeBuild`)** - Ensures all images are processed before build
5. **Build Complete (`afterBuild`)** - Registers manifest to prevent deletion

### Build Plugin

The plugin registers a Bun build plugin that intercepts image imports:

```
import hero from "./images/hero.jpg"
         ↓
// Transformed to JS module with utilities
const image = {
  src(size, format) { ... },
  srcset(format) { ... },
  sources() { ... },
  width: 1920,
  height: 1080,
  ...
}
export default image;
```

## Best Practices

### 1. Choose Appropriate Sizes

```typescript
// For full-width hero images
sizes: [640, 1280, 1920, 2560];

// For thumbnails/cards
sizes: [160, 320, 480];

// For content images
sizes: [320, 640, 960, 1280];
```

### 2. Use Multiple Formats

```typescript
// Recommended: WebP with AVIF for modern browsers
formats: ["avif", "webp"];

// With JPEG fallback for older browsers
formats: ["avif", "webp", "jpeg"];
```

### 3. Set Appropriate Quality

```typescript
// High quality for hero images
quality: 90;

// Standard quality for most images
quality: 80;

// Lower quality for thumbnails
quality: 70;
```

### 4. Use `<picture>` for Format Fallbacks

```tsx
<picture>
  {img.sources().map(({ srcset, type }) => (
    <source key={type} srcSet={srcset} type={type} />
  ))}
  <img src={img.src()} alt="..." />
</picture>
```

### 5. Always Set Width/Height

```tsx
// Prevents layout shift
<img src={img.src(640)} width={img.width} height={img.height} alt="..." />
```

## Troubleshooting

### Images Not Processing

1. Check that the input directory exists
2. Verify the files have supported extensions
3. Enable verbose mode: `verbose: true`

### Import Not Working

1. Ensure `enableImports: true` (default)
2. Add types to `tsconfig.json`
3. Verify the import path points to the input directory

### Build Errors

1. Check that `sharp` is installed: `bun add sharp`
2. Verify write permissions on output directory
3. Check console for specific error messages

### Large Bundle Size

The generated JS modules are lightweight (~1KB each). If you're seeing large bundles:

1. Ensure you're not importing the manifest unnecessarily
2. Use tree-shaking friendly imports

## API Reference

### `ImageOptimizerPlugin(options)`

Main plugin factory function.

### `OptimizedImage` (Import Type)

```typescript
interface OptimizedImage {
  src(size?: number, format?: string): string;
  srcset(format?: string): string;
  sources(): Array<{ srcset: string; type: string }>;
  width: number;
  height: number;
  sizes: number[];
  formats: string[];
  original: string;
}
```

### Helper Functions

```typescript
// Get srcset string from manifest
getSrcSet(manifest: ImageManifest, imagePath: string, format?: string): string

// Get optimal source URL for target width
getOptimalSrc(manifest: ImageManifest, imagePath: string, targetWidth: number, format?: string): string | null

// Get picture element sources
getPictureSources(manifest: ImageManifest, imagePath: string): Array<{ srcset: string; type: string }>
```

### On-The-Fly Utilities (`utils.ts`)

```typescript
// Types
type ImageFormat = "webp" | "avif" | "jpeg" | "jpg" | "png";

interface OnTheFlyOptions {
  width?: number;
  format?: ImageFormat;
  quality?: number;
  publicPath?: string;
  signal?: AbortSignal;
}

interface OnTheFlyResult {
  blob: Blob;
  contentType: string;
  optimizedOnTheFly: boolean;
  objectUrl: string;
  revoke: () => void;
}

// Functions
fetchOptimized(imagePath: string, options?: OnTheFlyOptions): Promise<OnTheFlyResult>
fetchOptimizedAsDataUrl(imagePath: string, options?: OnTheFlyOptions): Promise<string>
preloadOptimized(imagePath: string, options?: OnTheFlyOptions): Promise<void>
preloadOptimizedBatch(images: Array<{ path: string } & OptimizeOptions>, options?: { publicPath?: string; concurrency?: number }): Promise<void>
buildOptimizeUrl(imagePath: string, options?: OnTheFlyOptions): string
buildVariantUrl(baseName: string, width: number, format?: ImageFormat, publicPath?: string): string
```

## License

MIT

## Links

- [Frame-Master Documentation](https://frame-master.com/docs)
- [Frame-Master Plugins](https://frame-master.com/plugins)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Report Issues](https://github.com/shpaw415/frame-master-plugin-image-optimizer/issues)
