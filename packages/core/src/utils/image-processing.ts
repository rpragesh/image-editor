/**
 * Image processing utilities: HEIC conversion, EXIF correction, downscaling
 */

import { LoadedImageInfo } from '../types/index.js';
import { getMaxResolution } from './platform.js';

/**
 * Check if a file is HEIC format
 */
export function isHeicFile(file: File | Blob): boolean {
  if (file instanceof File) {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.heic') || ext.endsWith('.heif')) return true;
  }
  const type = file.type?.toLowerCase() || '';
  return type === 'image/heic' || type === 'image/heif';
}

/**
 * Convert HEIC to JPEG using heic2any (loaded dynamically)
 */
export async function convertHeicToJpeg(blob: Blob): Promise<Blob> {
  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    // heic2any can return a Blob or Blob[]
    if (Array.isArray(result)) {
      return result[0];
    }
    return result;
  } catch (err) {
    throw new Error(`HEIC conversion failed: ${(err as Error).message}. Please convert your image to JPEG or PNG before uploading.`);
  }
}

/**
 * Read EXIF orientation from an image blob and return the rotation needed
 * Returns degrees to rotate (0, 90, 180, 270)
 */
export async function getExifRotation(blob: Blob): Promise<number> {
  try {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // Check for JPEG SOI marker
    if (view.getUint16(0) !== 0xFFD8) return 0;

    let offset = 2;
    while (offset < view.byteLength - 2) {
      const marker = view.getUint16(offset);
      offset += 2;

      if (marker === 0xFFE1) {
        // APP1 — EXIF
        const length = view.getUint16(offset);

        // Check for 'Exif\0\0'
        const exifHeader = view.getUint32(offset + 2);
        if (exifHeader !== 0x45786966) {
          offset += length;
          continue;
        }

        const tiffOffset = offset + 8;
        const bigEndian = view.getUint16(tiffOffset) === 0x4D4D;

        const getUint16 = (o: number) =>
          bigEndian ? view.getUint16(o) : view.getUint16(o, true);
        const getUint32 = (o: number) =>
          bigEndian ? view.getUint32(o) : view.getUint32(o, true);

        const ifdOffset = tiffOffset + getUint32(tiffOffset + 4);
        const entries = getUint16(ifdOffset);

        for (let i = 0; i < entries; i++) {
          const entryOffset = ifdOffset + 2 + i * 12;
          if (getUint16(entryOffset) === 0x0112) {
            // Orientation tag
            const orientation = getUint16(entryOffset + 8);
            switch (orientation) {
              case 3: return 180;
              case 6: return 90;
              case 8: return 270;
              default: return 0;
            }
          }
        }
        return 0;
      } else if ((marker & 0xFF00) === 0xFF00) {
        offset += view.getUint16(offset);
      } else {
        break;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Load an image element from a blob
 */
export function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** A drawable image source together with its pixel dimensions. */
export interface OrientedImageSource {
  source: CanvasImageSource & { width: number; height: number };
  width: number;
  height: number;
  /**
   * `true` when EXIF orientation has already been baked into the returned
   * pixels (so callers must NOT rotate again). `false` only for the legacy
   * `<img>` fallback on engines without `createImageBitmap`.
   */
  orientationApplied: boolean;
}

/**
 * Load a blob as a correctly-oriented drawable source.
 *
 * Prefers `createImageBitmap(blob, { imageOrientation: 'from-image' })`, which
 * applies the EXIF orientation exactly once and returns a bitmap with no
 * residual EXIF metadata — so drawing it to a canvas can never re-rotate it.
 * Falls back to a plain `<img>` on engines that lack `createImageBitmap`.
 */
export async function loadOrientedImage(blob: Blob): Promise<OrientedImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        orientationApplied: true,
      };
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const img = await loadImageElement(blob);
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    orientationApplied: false,
  };
}

/**
 * Downscale an image using step-down sampling for quality
 */
export function downscaleImage(
  img: CanvasImageSource & { width: number; height: number },
  maxDimension: number,
  rotation: number = 0
): { canvas: HTMLCanvasElement; width: number; height: number } {
  let { width, height } = img;

  // After rotation, dimensions swap for 90/270 degrees
  const swapDims = rotation === 90 || rotation === 270;
  let targetW = swapDims ? height : width;
  let targetH = swapDims ? width : height;

  // Calculate scale to fit within maxDimension
  const scale = Math.min(1, maxDimension / Math.max(targetW, targetH));
  targetW = Math.round(targetW * scale);
  targetH = Math.round(targetH * scale);

  // Step-down sampling: halve until close to target, then final resize
  let currentCanvas = document.createElement('canvas');
  let currentCtx = currentCanvas.getContext('2d')!;

  // First, apply rotation
  if (rotation !== 0) {
    const rotCanvas = document.createElement('canvas');
    const rotCtx = rotCanvas.getContext('2d')!;

    if (swapDims) {
      rotCanvas.width = height;
      rotCanvas.height = width;
    } else {
      rotCanvas.width = width;
      rotCanvas.height = height;
    }

    rotCtx.save();
    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate((rotation * Math.PI) / 180);
    rotCtx.drawImage(img, -width / 2, -height / 2);
    rotCtx.restore();

    currentCanvas.width = rotCanvas.width;
    currentCanvas.height = rotCanvas.height;
    currentCtx.drawImage(rotCanvas, 0, 0);
    width = rotCanvas.width;
    height = rotCanvas.height;
  } else {
    currentCanvas.width = width;
    currentCanvas.height = height;
    currentCtx.drawImage(img, 0, 0);
  }

  // Step-down: keep halving until within 2x of target
  while (currentCanvas.width > targetW * 2 || currentCanvas.height > targetH * 2) {
    const halfW = Math.round(currentCanvas.width / 2);
    const halfH = Math.round(currentCanvas.height / 2);
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = halfW;
    stepCanvas.height = halfH;
    const stepCtx = stepCanvas.getContext('2d')!;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentCanvas, 0, 0, halfW, halfH);

    currentCanvas.width = 1;
    currentCanvas.height = 1;
    currentCanvas = stepCanvas;
    currentCtx = stepCtx;
  }

  // Final resize to exact target
  if (currentCanvas.width !== targetW || currentCanvas.height !== targetH) {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetW;
    finalCanvas.height = targetH;
    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(currentCanvas, 0, 0, targetW, targetH);

    currentCanvas.width = 1;
    currentCanvas.height = 1;

    return { canvas: finalCanvas, width: targetW, height: targetH };
  }

  return { canvas: currentCanvas, width: targetW, height: targetH };
}

/**
 * Full image loading pipeline: HEIC → EXIF → Downscale → Data URL
 */
export async function processImage(
  source: File | Blob | string,
  configMaxResolution: number | null | undefined
): Promise<{ dataUrl: string; info: LoadedImageInfo }> {
  let blob: Blob;
  let wasHeicConverted = false;

  // Step 0: Get a blob from the source
  if (typeof source === 'string') {
    const response = await fetch(source);
    blob = await response.blob();
  } else {
    blob = source;
  }

  // Step 1: HEIC detection and conversion
  if (isHeicFile(blob instanceof File ? blob : new File([blob], 'image', { type: blob.type }))) {
    blob = await convertHeicToJpeg(blob);
    wasHeicConverted = true;
  }

  // Step 3: Load a correctly-oriented drawable source. When the browser
  // bakes EXIF orientation into the pixels (createImageBitmap / auto-orient),
  // the source is already upright and must NOT be rotated again — doing so
  // would flip portrait photos to landscape. Only the legacy <img> fallback
  // needs the manual EXIF rotation.
  const oriented = await loadOrientedImage(blob);
  const originalWidth = oriented.width;
  const originalHeight = oriented.height;

  // Step 2: EXIF orientation — only apply manually when the source pixels
  // were NOT already oriented by the browser.
  const exifRotation = oriented.orientationApplied ? 0 : await getExifRotation(blob);
  const wasExifCorrected = exifRotation !== 0 || oriented.orientationApplied;

  // Step 4: Determine max resolution
  const maxRes = getMaxResolution(configMaxResolution);
  const needsDownscale = maxRes !== null && (originalWidth > maxRes || originalHeight > maxRes);

  let dataUrl: string;
  let processedWidth: number;
  let processedHeight: number;

  if (needsDownscale || exifRotation !== 0) {
    const result = downscaleImage(oriented.source, maxRes || Math.max(originalWidth, originalHeight), exifRotation);
    dataUrl = result.canvas.toDataURL('image/png');
    processedWidth = result.width;
    processedHeight = result.height;
    result.canvas.width = 1;
    result.canvas.height = 1;
  } else {
    // No processing needed — just create data URL for fabric
    const canvas = document.createElement('canvas');
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(oriented.source, 0, 0);
    dataUrl = canvas.toDataURL('image/png');
    processedWidth = originalWidth;
    processedHeight = originalHeight;
    canvas.width = 1;
    canvas.height = 1;
  }

  // Release the decoded bitmap if the browser gave us one.
  if (typeof (oriented.source as ImageBitmap).close === 'function') {
    (oriented.source as ImageBitmap).close();
  }

  return {
    dataUrl,
    info: {
      originalWidth,
      originalHeight,
      processedWidth,
      processedHeight,
      wasDownscaled: needsDownscale || false,
      wasHeicConverted,
      wasExifCorrected,
      format: wasHeicConverted ? 'jpeg' : (blob.type || 'image/png'),
    },
  };
}
