/**
 * Small thumbnails of the current photo with each filter preset applied,
 * for the Filters panel. The math mirrors the Fabric filters the editor
 * applies (see `rebuildImageFilters` in editor.ts), so a tile looks like
 * the result of clicking it.
 */
import type { ImageFilterPreset } from '../types/index.js';

type Matrix = number[]; // 4×5 row-major, offsets in 0..1 (× 255), as in Fabric's ColorMatrix

const MATRICES: Partial<Record<ImageFilterPreset, Matrix>> = {
  // fabric.Image.filters.Sepia
  sepia: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0],
  // fabric.Image.filters.Vintage
  vintage: [
    0.62793, 0.32021, -0.03965, 0, 0.03784, 0.02578, 0.64411, 0.03259, 0, 0.02926,
    0.0466, -0.08512, 0.52416, 0, 0.02023, 0, 0, 0, 1, 0,
  ],
  // Editor's custom ColorMatrix presets
  cool: [0.9, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 1.15, 0, 0, 0, 0, 0, 1, 0],
  warm: [1.15, 0, 0, 0, 0, 0, 1.02, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 1, 0],
};

function applyPreset(data: Uint8ClampedArray, preset: ImageFilterPreset): void {
  const m = MATRICES[preset];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (preset === 'grayscale') {
      // fabric.Image.filters.Grayscale, mode 'average'
      const v = (r + g + b) / 3;
      data[i] = data[i + 1] = data[i + 2] = v;
    } else if (preset === 'invert') {
      data[i] = 255 - r;
      data[i + 1] = 255 - g;
      data[i + 2] = 255 - b;
    } else if (m) {
      data[i] = r * m[0] + g * m[1] + b * m[2] + m[4] * 255;
      data[i + 1] = r * m[5] + g * m[6] + b * m[7] + m[9] * 255;
      data[i + 2] = r * m[10] + g * m[11] + b * m[12] + m[14] * 255;
    }
  }
}

/**
 * Render one thumbnail per preset. `source` is the unfiltered photo as the
 * editor displays it (already cropped and rotated); `flipX`/`flipY` mirror
 * it the way the base image is mirrored on the canvas. Returns data URLs
 * keyed by preset, or `null` if the browser can't read the pixels back
 * (e.g. a cross-origin image without CORS).
 */
export function renderFilterPreviews(
  source: CanvasImageSource & { width: number; height: number },
  presets: ImageFilterPreset[],
  opts: { size?: number; flipX?: boolean; flipY?: boolean } = {},
): Record<string, string> | null {
  const sw = (source as HTMLImageElement).naturalWidth || source.width;
  const sh = (source as HTMLImageElement).naturalHeight || source.height;
  if (!sw || !sh) return null;

  // Square-ish crop from the centre so every tile shows the same subject.
  const size = opts.size ?? 160;
  const side = Math.min(sw, sh);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.75);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const cropW = side;
  const cropH = side * 0.75;
  ctx.save();
  ctx.translate(opts.flipX ? canvas.width : 0, opts.flipY ? canvas.height : 0);
  ctx.scale(opts.flipX ? -1 : 1, opts.flipY ? -1 : 1);
  ctx.drawImage(source, (sw - cropW) / 2, (sh - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  let base: ImageData;
  try {
    base = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null; // tainted canvas
  }

  const out: Record<string, string> = {};
  for (const preset of presets) {
    const img = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    if (preset !== 'none') applyPreset(img.data, preset);
    ctx.putImageData(img, 0, 0);
    out[preset] = canvas.toDataURL('image/jpeg', 0.82);
  }
  return out;
}
