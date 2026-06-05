// Converts a browser File/image Blob to optimized WebP for upload.
// - Max long-edge 1920 px (no upscaling)
// - Quality 0.82 (good visual quality, small file size, SEO/GEO friendly)
// - Falls back to the original file if the browser cannot encode WebP
//   (very old Safari) or if any step fails.

export interface WebpConvertResult {
  blob: Blob;
  width: number;
  height: number;
  isWebp: boolean;
}

const MAX_EDGE = 1920;
const QUALITY = 0.82;

async function loadImage(file: File): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function convertFileToWebp(file: File): Promise<WebpConvertResult> {
  try {
    const img = await loadImage(file);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error("invalid dimensions");

    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", QUALITY),
    );
    if (!blob || blob.type !== "image/webp") {
      // Browser refused to encode webp — fall back to original.
      return { blob: file, width: srcW, height: srcH, isWebp: file.type === "image/webp" };
    }

    return { blob, width: dstW, height: dstH, isWebp: true };
  } catch (err) {
    console.warn("convertFileToWebp fallback:", err);
    return {
      blob: file,
      width: 0,
      height: 0,
      isWebp: file.type === "image/webp",
    };
  }
}

export function toWebpFilename(name: string | null | undefined): string {
  const base = (name ?? "photo").replace(/\.[^.]+$/, "");
  return `${base || "photo"}.webp`;
}