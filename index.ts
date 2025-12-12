// frame-master-plugin-image-optimizer.ts
import type { FrameMasterPlugin } from "frame-master/plugin";
import packageJson from "./package.json";
import sharp from "sharp";
import { join } from "path";
import { readdir, mkdir, stat } from "fs/promises";
import { isBuildMode } from "frame-master/utils";

// ===== Types =====

export interface ImageOptimizerOptions {
  /** Directory containing source images (relative to project root) */
  input: string;
  /** Output directory for optimized images (default: "static/optimized") */
  output?: string;
  /** Public URL prefix for images (default: "/optimized") */
  publicPath?: string;
  /** Formats to generate (default: ["webp"]) */
  formats?: ("webp" | "avif" | "png" | "jpeg")[];
  /** Widths to generate for responsive images (default: [320, 640, 1280]) */
  sizes?: number[];
  /** Compression quality 1-100 (default: 80) */
  quality?: number;
  /** Enable file watching in dev mode (default: true) */
  watch?: boolean;
  /** Generate a manifest.json file (default: true) */
  generateManifest?: boolean;
  /** Preserve original images in output (default: false) */
  keepOriginal?: boolean;
  /** Skip processing if output already exists (default: true) */
  skipExisting?: boolean;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Enable importing images as JS modules (default: true) */
  enableImports?: boolean;
}

export interface ImageManifestEntry {
  original: string;
  width: number;
  height: number;
  variants: {
    format: string;
    size: number;
    path: string;
    width: number;
    height: number;
  }[];
}

export interface ImageManifest {
  generatedAt: string;
  images: Record<string, ImageManifestEntry>;
}

/**
 * Type for the imported image module
 * This is what you get when you `import img from "./image.jpg"`
 */
export interface OptimizedImage {
  /** Get the URL for a specific size and format */
  src: (size?: number, format?: string) => string;
  /** Get srcset string for responsive images */
  srcset: (format?: string) => string;
  /** Get all available sources for <picture> element */
  sources: () => Array<{ srcset: string; type: string }>;
  /** Original image width */
  width: number;
  /** Original image height */
  height: number;
  /** Available sizes */
  sizes: number[];
  /** Available formats */
  formats: string[];
  /** Original file path */
  original: string;
}

type SupportedInputFormat =
  | "jpeg"
  | "jpg"
  | "png"
  | "gif"
  | "webp"
  | "avif"
  | "tiff"
  | "svg";

// ===== Constants =====

const SUPPORTED_EXTENSIONS = new Set<string>([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".tiff",
  ".svg",
]);

const LOG_PREFIX = "[image-optimizer]";

// ===== Helper Functions =====

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return SUPPORTED_EXTENSIONS.has(ext);
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function getImageFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(
    currentDir: string,
    relativePath: string = ""
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relPath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        await scan(fullPath, relPath);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        files.push(relPath);
      }
    }
  }

  await scan(dir);
  return files;
}

function getOutputFilename(
  originalName: string,
  width: number,
  format: string
): string {
  const baseName = originalName.slice(0, originalName.lastIndexOf("."));
  return `${baseName}-${width}w.${format}`;
}

// ===== Image Import Plugin Factory =====

function createImageImportPlugin(
  inputDir: string,
  publicPath: string,
  defaultSizes: number[],
  defaultFormats: string[],
  manifest: ImageManifest
): Bun.BunPlugin {
  // Normalize paths
  const normalizedInputDir = inputDir.replace(/\\/g, "/");

  // Create regex to match image imports from input directory
  const imageExtensions = Array.from(SUPPORTED_EXTENSIONS)
    .map((ext) => ext.slice(1))
    .join("|");
  const filterRegex = new RegExp(`\\.(${imageExtensions})$`, "i");

  return {
    name: "image-optimizer-import",
    setup(build) {
      // Handle image file imports
      build.onLoad({ filter: filterRegex }, async (args) => {
        const filePath = args.path;
        const normalizedPath = filePath.replace(/\\/g, "/");

        // Check if this image is in our input directory
        if (!normalizedPath.includes(normalizedInputDir)) {
          return undefined; // Let other loaders handle it
        }

        // Get relative path from input directory
        const inputDirIndex = normalizedPath.indexOf(normalizedInputDir);
        const relativePath = normalizedPath.slice(
          inputDirIndex + normalizedInputDir.length + 1
        );

        // Check if we have manifest data for this image
        const manifestEntry = manifest.images[relativePath];

        // Get image metadata
        let width = manifestEntry?.width ?? 0;
        let height = manifestEntry?.height ?? 0;
        let variants = manifestEntry?.variants ?? [];

        // If no manifest entry, try to read metadata directly
        if (!manifestEntry) {
          try {
            const sharp = (await import("sharp")).default;
            const metadata = await sharp(filePath).metadata();
            width = metadata.width ?? 0;
            height = metadata.height ?? 0;

            // Generate expected variants based on config
            const aspectRatio = height / width;
            for (const size of defaultSizes) {
              if (size <= width) {
                for (const format of defaultFormats) {
                  variants.push({
                    format,
                    size,
                    path: getOutputFilename(relativePath, size, format),
                    width: size,
                    height: Math.round(size * aspectRatio),
                  });
                }
              }
            }
          } catch {
            // Fallback: generate with config defaults
            for (const size of defaultSizes) {
              for (const format of defaultFormats) {
                variants.push({
                  format,
                  size,
                  path: getOutputFilename(relativePath, size, format),
                  width: size,
                  height: 0,
                });
              }
            }
          }
        }

        // Get unique sizes and formats
        const sizes = [...new Set(variants.map((v) => v.size))].sort(
          (a, b) => a - b
        );
        const formats = [...new Set(variants.map((v) => v.format))];

        // Generate the JS module code
        const moduleCode = `
// Auto-generated by frame-master-plugin-image-optimizer
const variants = ${JSON.stringify(variants)};
const publicPath = ${JSON.stringify(publicPath)};

const image = {
  width: ${width},
  height: ${height},
  sizes: ${JSON.stringify(sizes)},
  formats: ${JSON.stringify(formats)},
  original: ${JSON.stringify(relativePath)},
  
  src(size, format = "${defaultFormats[0]}") {
    // If no size specified, return the largest available
    if (!size) {
      const matching = variants.filter(v => v.format === format);
      if (matching.length === 0) return publicPath + "/" + ${JSON.stringify(
        relativePath
      )};
      const largest = matching.reduce((a, b) => a.width > b.width ? a : b);
      return publicPath + "/" + largest.path;
    }
    
    // Find exact match or next larger size
    const matching = variants
      .filter(v => v.format === format)
      .sort((a, b) => a.width - b.width);
    
    const exact = matching.find(v => v.width === size);
    if (exact) return publicPath + "/" + exact.path;
    
    const larger = matching.find(v => v.width >= size);
    if (larger) return publicPath + "/" + larger.path;
    
    // Return largest if requested size is bigger than all variants
    if (matching.length > 0) {
      return publicPath + "/" + matching[matching.length - 1].path;
    }
    
    return publicPath + "/" + ${JSON.stringify(relativePath)};
  },
  
  srcset(format = "${defaultFormats[0]}") {
    return variants
      .filter(v => v.format === format)
      .map(v => publicPath + "/" + v.path + " " + v.width + "w")
      .join(", ");
  },
  
  sources() {
    const formatGroups = {};
    for (const v of variants) {
      if (!formatGroups[v.format]) formatGroups[v.format] = [];
      formatGroups[v.format].push(v);
    }
    
    return Object.entries(formatGroups).map(([format, vars]) => ({
      srcset: vars.map(v => publicPath + "/" + v.path + " " + v.width + "w").join(", "),
      type: "image/" + format,
    }));
  },
};

export default image;
export const { src, srcset, sources, width, height, sizes, formats, original } = image;
`;

        return {
          contents: moduleCode,
          loader: "js",
        };
      });
    },
  };
}

// ===== Main Plugin =====

export default function ImageOptimizerPlugin(
  options: ImageOptimizerOptions
): FrameMasterPlugin {
  // Merge with defaults
  const config = {
    input: options.input,
    output: options.output ?? "static/optimized",
    publicPath: options.publicPath ?? "/optimized",
    formats: options.formats ?? ["webp"],
    sizes: options.sizes ?? [320, 640, 1280],
    quality: options.quality ?? 80,
    watch: options.watch ?? true,
    generateManifest: options.generateManifest ?? true,
    keepOriginal: options.keepOriginal ?? false,
    skipExisting: options.skipExisting ?? true,
    verbose: options.verbose ?? false,
    enableImports: options.enableImports ?? true,
  };

  // Plugin state
  const manifest: ImageManifest = {
    generatedAt: new Date().toISOString(),
    images: {},
  };
  let isProcessing = false;
  let pendingFiles = new Set<string>();

  // Logging helpers - only log in build mode or when verbose is enabled
  const log = (msg: string) => {
    if (isBuildMode() || config.verbose) {
      console.log(`${LOG_PREFIX} ${msg}`);
    }
  };
  const logVerbose = (msg: string) =>
    config.verbose && console.log(`${LOG_PREFIX} ${msg}`);
  const logError = (msg: string) => console.error(`${LOG_PREFIX} ❌ ${msg}`);

  // Get absolute paths
  const getInputPath = () => join(process.cwd(), config.input);
  const getOutputPath = () => join(process.cwd(), config.output);
  const getManifestPath = () => join(getOutputPath(), "manifest.json");

  /**
   * Load existing manifest from disk if available
   */
  async function loadManifest(): Promise<boolean> {
    try {
      const manifestPath = getManifestPath();
      if (await fileExists(manifestPath)) {
        const content = await Bun.file(manifestPath).json();
        manifest.generatedAt = content.generatedAt;
        manifest.images = content.images;
        logVerbose(
          `Loaded existing manifest with ${
            Object.keys(manifest.images).length
          } images`
        );
        return true;
      }
    } catch (err) {
      logVerbose(`Could not load manifest: ${err}`);
    }
    return false;
  }

  /**
   * Check if an image needs reprocessing based on file modification time
   */
  async function needsProcessing(relativePath: string): Promise<boolean> {
    const inputPath = join(getInputPath(), relativePath);
    const manifestEntry = manifest.images[relativePath];

    // No manifest entry = needs processing
    if (!manifestEntry || manifestEntry.variants.length === 0) {
      return true;
    }

    // Check if any output file is missing
    for (const variant of manifestEntry.variants) {
      const outputPath = join(getOutputPath(), variant.path);
      if (!(await fileExists(outputPath))) {
        logVerbose(`Missing variant: ${variant.path}`);
        return true;
      }
    }

    // Check if input is newer than outputs (modification time check)
    try {
      const inputStat = await stat(inputPath);
      const firstVariant = manifestEntry.variants[0];
      if (!firstVariant) {
        return true;
      }
      const outputPath = join(getOutputPath(), firstVariant.path);
      const outputStat = await stat(outputPath);

      if (inputStat.mtimeMs > outputStat.mtimeMs) {
        logVerbose(`Source modified: ${relativePath}`);
        return true;
      }
    } catch {
      return true;
    }

    return false;
  }

  /**
   * Process a single image file
   */
  async function processImage(relativePath: string): Promise<void> {
    const inputPath = join(getInputPath(), relativePath);
    const outputDir = join(
      getOutputPath(),
      relativePath.slice(0, relativePath.lastIndexOf("/") + 1)
    );

    await ensureDir(outputDir);

    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        logError(`Could not read metadata for ${relativePath}`);
        return;
      }

      const originalWidth = metadata.width;
      const originalHeight = metadata.height;
      const aspectRatio = originalHeight / originalWidth;

      const variants: ImageManifestEntry["variants"] = [];

      // Process each size
      for (const targetWidth of config.sizes) {
        // Skip sizes larger than original
        if (targetWidth > originalWidth) {
          logVerbose(
            `Skipping ${targetWidth}w for ${relativePath} (original is ${originalWidth}w)`
          );
          continue;
        }

        const targetHeight = Math.round(targetWidth * aspectRatio);

        // Process each format
        for (const format of config.formats) {
          const outputFilename = getOutputFilename(
            relativePath,
            targetWidth,
            format
          );
          const outputPath = join(getOutputPath(), outputFilename);

          // Skip if exists and skipExisting is enabled
          if (config.skipExisting && (await fileExists(outputPath))) {
            logVerbose(`Skipping existing: ${outputFilename}`);
            variants.push({
              format,
              size: targetWidth,
              path: outputFilename,
              width: targetWidth,
              height: targetHeight,
            });
            continue;
          }

          // Ensure output directory exists
          const outputFileDir = outputPath.slice(
            0,
            outputPath.lastIndexOf("/")
          );
          await ensureDir(outputFileDir);

          // Create optimized image
          let pipeline = sharp(inputPath).resize(targetWidth, targetHeight, {
            fit: "cover",
            withoutEnlargement: true,
          });

          // Apply format-specific options
          switch (format) {
            case "webp":
              pipeline = pipeline.webp({ quality: config.quality });
              break;
            case "avif":
              pipeline = pipeline.avif({ quality: config.quality });
              break;
            case "jpeg":
              pipeline = pipeline.jpeg({
                quality: config.quality,
                mozjpeg: true,
              });
              break;
            case "png":
              pipeline = pipeline.png({
                quality: config.quality,
                compressionLevel: 9,
              });
              break;
          }

          await pipeline.toFile(outputPath);

          const outputStats = await stat(outputPath);

          variants.push({
            format,
            size: targetWidth,
            path: outputFilename,
            width: targetWidth,
            height: targetHeight,
          });

          logVerbose(
            `Generated: ${outputFilename} (${(outputStats.size / 1024).toFixed(
              1
            )}KB)`
          );
        }
      }

      // Copy original if requested
      if (config.keepOriginal) {
        const originalOutputPath = join(getOutputPath(), relativePath);
        const originalOutputDir = originalOutputPath.slice(
          0,
          originalOutputPath.lastIndexOf("/")
        );
        await ensureDir(originalOutputDir);
        await Bun.write(originalOutputPath, Bun.file(inputPath));
      }

      // Update manifest
      manifest.images[relativePath] = {
        original: relativePath,
        width: originalWidth,
        height: originalHeight,
        variants,
      };

      log(`✅ Processed: ${relativePath} → ${variants.length} variants`);
    } catch (err) {
      logError(`Failed to process ${relativePath}: ${err}`);
    }
  }

  /**
   * Process all images in input directory (full rebuild)
   */
  async function processAllImages(forceAll: boolean = false): Promise<void> {
    if (isProcessing) {
      log("Already processing, skipping...");
      return;
    }

    isProcessing = true;
    const startTime = Date.now();

    try {
      const inputDir = getInputPath();

      // Check if input directory exists
      if (!(await fileExists(inputDir))) {
        logError(`Input directory does not exist: ${config.input}`);
        return;
      }

      // Get all image files
      const imageFiles = await getImageFiles(inputDir);

      if (imageFiles.length === 0) {
        log(`No images found in ${config.input}`);
        return;
      }

      // Ensure output directory exists
      await ensureDir(getOutputPath());

      // Filter to only images that need processing (unless forceAll)
      let filesToProcess: string[];
      if (forceAll) {
        filesToProcess = imageFiles;
        log(`Force processing ${imageFiles.length} images...`);
      } else {
        filesToProcess = [];
        for (const file of imageFiles) {
          if (await needsProcessing(file)) {
            filesToProcess.push(file);
          }
        }

        if (filesToProcess.length === 0) {
          log(`All ${imageFiles.length} images are up to date ✨`);
          return;
        }

        log(
          `Processing ${filesToProcess.length}/${imageFiles.length} images (${
            imageFiles.length - filesToProcess.length
          } cached)...`
        );
      }

      // Process images that need it
      for (const file of filesToProcess) {
        await processImage(file);
      }

      // Write manifest
      if (config.generateManifest) {
        manifest.generatedAt = new Date().toISOString();
        await Bun.write(getManifestPath(), JSON.stringify(manifest, null, 2));
        log(`📄 Manifest written to ${config.output}/manifest.json`);
      }

      const duration = Date.now() - startTime;
      log(`🎉 Completed in ${(duration / 1000).toFixed(2)}s`);
    } catch (err) {
      logError(`Processing failed: ${err}`);
    } finally {
      isProcessing = false;
    }
  }

  /**
   * Process pending files (debounced for file watching)
   */
  async function processPendingFiles(): Promise<void> {
    if (pendingFiles.size === 0) return;

    const files = Array.from(pendingFiles);
    pendingFiles.clear();

    for (const file of files) {
      await processImage(file);
    }

    // Update manifest
    if (config.generateManifest) {
      manifest.generatedAt = new Date().toISOString();
      await Bun.write(getManifestPath(), JSON.stringify(manifest, null, 2));
    }
  }

  // Debounce timer for file watching
  let debounceTimer: Timer | null = null;

  /**
   * Optimize an image on-the-fly and return the buffer
   */
  async function optimizeOnTheFly(
    relativePath: string,
    width: number | undefined,
    format: string,
    quality: number
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const inputPath = join(getInputPath(), relativePath);

    // Check if source image exists
    if (!(await fileExists(inputPath))) {
      return null;
    }

    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return null;
      }

      // Calculate target dimensions
      const targetWidth = width ?? metadata.width;
      const aspectRatio = metadata.height / metadata.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      // Create pipeline
      let pipeline = sharp(inputPath).resize(targetWidth, targetHeight, {
        fit: "cover",
        withoutEnlargement: true,
      });

      // Apply format
      let contentType: string;
      switch (format) {
        case "webp":
          pipeline = pipeline.webp({ quality });
          contentType = "image/webp";
          break;
        case "avif":
          pipeline = pipeline.avif({ quality });
          contentType = "image/avif";
          break;
        case "jpeg":
        case "jpg":
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          contentType = "image/jpeg";
          break;
        case "png":
          pipeline = pipeline.png({ quality, compressionLevel: 9 });
          contentType = "image/png";
          break;
        default:
          // Keep original format
          contentType = `image/${metadata.format ?? "jpeg"}`;
      }

      const buffer = await pipeline.toBuffer();
      return { buffer, contentType };
    } catch (err) {
      logError(`On-the-fly optimization failed for ${relativePath}: ${err}`);
      return null;
    }
  }

  return {
    name: packageJson.name,
    version: packageJson.version,

    requirement: {
      frameMasterVersion: ">=3.0.0",
      bunVersion: ">=1.2.0",
    },

    // API endpoint for on-the-fly optimization
    serverConfig: {
      routes: {
        [`${config.publicPath}/*`]: async (req: Request) => {
          const url = new URL(req.url);
          const pathname = url.pathname;

          // Extract path after publicPath
          const relativePath = pathname.slice(config.publicPath.length + 1);

          if (!relativePath || !isImageFile(relativePath)) {
            return new Response("Not found", { status: 404 });
          }

          // Check if this is a pre-processed variant (e.g., hero-640w.webp)
          const variantMatch = relativePath.match(
            /^(.+)-(\d+)w\.(webp|avif|jpeg|jpg|png)$/i
          );

          if (variantMatch) {
            // Try to serve from output directory first
            const outputPath = join(getOutputPath(), relativePath);
            if (await fileExists(outputPath)) {
              const file = Bun.file(outputPath);
              return new Response(file, {
                headers: {
                  "Content-Type": file.type,
                  "Cache-Control": "public, max-age=31536000, immutable",
                },
              });
            }

            // Generate on-the-fly if not found
            const basePath = variantMatch[1]!;
            const widthStr = variantMatch[2]!;
            const format = variantMatch[3]!;
            const width = parseInt(widthStr, 10);

            // Find original file (try common extensions)
            let originalPath: string | null = null;
            for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".avif"]) {
              const testPath = `${basePath}${ext}`;
              if (await fileExists(join(getInputPath(), testPath))) {
                originalPath = testPath;
                break;
              }
            }

            if (!originalPath) {
              return new Response("Source image not found", { status: 404 });
            }

            const result = await optimizeOnTheFly(
              originalPath,
              width,
              format,
              config.quality
            );

            if (!result) {
              return new Response("Failed to process image", { status: 500 });
            }

            // Optionally cache to disk
            const baseDir = basePath.slice(0, basePath.lastIndexOf("/") + 1);
            if (baseDir) {
              await ensureDir(join(getOutputPath(), baseDir));
            } else {
              await ensureDir(getOutputPath());
            }
            await Bun.write(outputPath, result.buffer);

            return new Response(Buffer.from(result.buffer), {
              headers: {
                "Content-Type": result.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          }

          // Handle dynamic optimization via query params
          // e.g., /optimized/hero.jpg?w=800&format=webp&q=85
          const widthParam = url.searchParams.get("w");
          const formatParam = url.searchParams.get("format");
          const qualityParam = url.searchParams.get("q");

          const width = widthParam ? parseInt(widthParam, 10) : undefined;
          const format = formatParam ?? config.formats[0] ?? "webp";
          const quality = qualityParam
            ? parseInt(qualityParam, 10)
            : config.quality;

          // If no query params, try to serve original from output or input
          if (!widthParam && !formatParam && !qualityParam) {
            // Try output first
            const outputPath = join(getOutputPath(), relativePath);
            if (await fileExists(outputPath)) {
              const file = Bun.file(outputPath);
              return new Response(file, {
                headers: {
                  "Content-Type": file.type,
                  "Cache-Control": "public, max-age=31536000, immutable",
                },
              });
            }

            // Fall back to input (original)
            const inputPath = join(getInputPath(), relativePath);
            if (await fileExists(inputPath)) {
              const file = Bun.file(inputPath);
              return new Response(file, {
                headers: {
                  "Content-Type": file.type,
                  "Cache-Control": "public, max-age=86400",
                },
              });
            }

            return new Response("Not found", { status: 404 });
          }

          // Generate optimized version on-the-fly
          const result = await optimizeOnTheFly(
            relativePath,
            width,
            format,
            quality
          );

          if (!result) {
            return new Response("Failed to process image", { status: 500 });
          }

          return new Response(Buffer.from(result.buffer), {
            headers: {
              "Content-Type": result.contentType,
              "Cache-Control": "public, max-age=86400",
              "X-Image-Optimized": "on-the-fly",
            },
          });
        },
      },
    },

    serverStart: {
      main: async () => {
        log(`🖼️  Image Optimizer initialized`);
        log(`   Input:   ${config.input}`);
        log(`   Output:  ${config.output}`);
        log(`   Formats: ${config.formats.join(", ")}`);
        log(`   Sizes:   ${config.sizes.join(", ")}w`);

        // Try to load existing manifest for incremental processing
        const hasManifest = await loadManifest();

        if (hasManifest) {
          log(`📦 Loaded cached manifest, checking for changes...`);
        }

        // Process images (incremental - only changed/new images)
        await processAllImages(false);
      },
    },

    // File watching for dev mode
    fileSystemWatchDir: config.watch ? [config.input] : [],

    onFileSystemChange: async (eventType, filePath, absolutePath) => {
      if (!isImageFile(filePath)) return;

      log(`📁 File ${eventType}: ${filePath}`);

      // Add to pending and debounce
      pendingFiles.add(filePath);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        await processPendingFiles();
        debounceTimer = null;
      }, 300);
    },

    // Runtime plugin for server-side image imports
    runtimePlugins: config.enableImports
      ? [
          createImageImportPlugin(
            getInputPath(),
            config.publicPath,
            config.sizes,
            config.formats,
            manifest
          ),
        ]
      : [],

    // Build hooks
    build: {
      // Include the image import plugin in build config
      buildConfig: config.enableImports
        ? {
            plugins: [
              createImageImportPlugin(
                getInputPath(),
                config.publicPath,
                config.sizes,
                config.formats,
                manifest
              ),
            ],
          }
        : {},

      beforeBuild: async (buildConfig, builder) => {
        // Force full rebuild only in production mode
        const forceAll = isBuildMode();

        if (forceAll) {
          log(
            `🔨 Running pre-build image optimization (production - full rebuild)...`
          );
        } else {
          log(`🔨 Running pre-build image optimization (incremental)...`);
        }

        await processAllImages(forceAll);
      },

      afterBuild: async (buildConfig, result, builder) => {
        if (!result.success) return;

        // Register manifest file to prevent deletion
        if (config.generateManifest) {
          const manifestPath = getManifestPath();
          if (await fileExists(manifestPath)) {
            result.outputs.push({
              path: manifestPath,
              kind: "asset",
              hash: "",
              loader: "file",
            } as Bun.BuildArtifact);
          }
        }

        log(`✅ Image optimization complete for build`);
      },
    },

    // CLI extension for manual operations
    cli: (command) => {
      command
        .command("images")
        .description("Image optimization commands")
        .option("-p, --process", "Process all images now")
        .option("-f, --force", "Force reprocess all images")
        .option("-c, --clean", "Clean output directory")
        .option("-m, --manifest", "Regenerate manifest only")
        .option("-v, --verbose", "Enable verbose output")
        .action(async (opts) => {
          if (opts.verbose) {
            (config as { verbose: boolean }).verbose = true;
          }

          if (opts.clean) {
            const outputDir = getOutputPath();
            log(`🧹 Cleaning ${outputDir}...`);
            try {
              const { rm } = await import("fs/promises");
              await rm(outputDir, { recursive: true, force: true });
              // Clear manifest after cleaning
              manifest.images = {};
              log(`✅ Output directory cleaned`);
            } catch (err) {
              logError(`Failed to clean: ${err}`);
            }
            return;
          }

          if (opts.manifest) {
            log(`📄 Regenerating manifest...`);
            manifest.generatedAt = new Date().toISOString();
            await Bun.write(
              getManifestPath(),
              JSON.stringify(manifest, null, 2)
            );
            log(`✅ Manifest regenerated`);
            return;
          }

          if (opts.process) {
            // Load existing manifest for incremental processing
            await loadManifest();
            await processAllImages(opts.force ?? false);
            return;
          }

          // Default: show help
          command.outputHelp();
        });

      return command;
    },
  };
}

// ===== Client-side Helpers (can be imported separately) =====

/**
 * Get srcset string for responsive images
 */
export function getSrcSet(
  manifest: ImageManifest,
  imagePath: string,
  format: string = "webp"
): string {
  const entry = manifest.images[imagePath];
  if (!entry) return "";

  return entry.variants
    .filter((v) => v.format === format)
    .map((v) => `${v.path} ${v.width}w`)
    .join(", ");
}

/**
 * Get optimal image source for a target width
 */
export function getOptimalSrc(
  manifest: ImageManifest,
  imagePath: string,
  targetWidth: number,
  format: string = "webp"
): string | null {
  const entry = manifest.images[imagePath];
  if (!entry) return null;

  const variants = entry.variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width);

  // Find smallest variant that's >= targetWidth
  const optimal = variants.find((v) => v.width >= targetWidth);
  return optimal?.path ?? variants[variants.length - 1]?.path ?? null;
}

/**
 * Generate picture element sources
 */
export function getPictureSources(
  manifest: ImageManifest,
  imagePath: string,
  sizes: string = "100vw"
): Array<{ srcset: string; type: string }> {
  const entry = manifest.images[imagePath];
  if (!entry) return [];

  const formats = [...new Set(entry.variants.map((v) => v.format))];

  return formats.map((format) => ({
    srcset: getSrcSet(manifest, imagePath, format),
    type: `image/${format}`,
  }));
}
