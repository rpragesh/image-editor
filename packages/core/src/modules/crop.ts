/**
 * Crop Module — handles free crop, aspect-ratio locked crop, and crop application
 */
import { fabric } from 'fabric';
import { CropAspectRatio } from '../types/index.js';

export class CropModule {
  private canvas: fabric.Canvas;
  private cropRect: fabric.Rect | null = null;
  private overlay: fabric.Rect | null = null;
  private aspectRatio: number | null = null;
  private isActive = false;
  private imageObject: fabric.Image | null = null;
  private minCropSize = 50;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  /**
   * Activate crop mode with an optional aspect ratio
   */
  activate(imageObject: fabric.Image, ratio: number | null = null): void {
    this.deactivate();
    this.imageObject = imageObject;
    this.aspectRatio = ratio;
    this.isActive = true;

    // Get the image's bounding box on canvas
    const imgBounds = this.getImageBounds();

    // Create semi-transparent overlay (darkens area outside crop)
    this.overlay = new fabric.Rect({
      left: 0,
      top: 0,
      width: this.canvas.getWidth(),
      height: this.canvas.getHeight(),
      fill: 'rgba(0, 0, 0, 0.5)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    (this.overlay as any)._rpOverlay = true;

    // Default crop rect: 80% of image area, centered
    let cropW = imgBounds.width * 0.8;
    let cropH = imgBounds.height * 0.8;

    if (ratio !== null) {
      // Fit crop to aspect ratio within image bounds
      if (cropW / cropH > ratio) {
        cropW = cropH * ratio;
      } else {
        cropH = cropW / ratio;
      }
    }

    const cropLeft = imgBounds.left + (imgBounds.width - cropW) / 2;
    const cropTop = imgBounds.top + (imgBounds.height - cropH) / 2;

    this.cropRect = new fabric.Rect({
      left: cropLeft,
      top: cropTop,
      width: cropW,
      height: cropH,
      fill: 'transparent',
      stroke: '#4a90d9',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      cornerColor: '#4a90d9',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
      hasRotatingPoint: false,
      lockRotation: true,
      selectable: true,
      evented: true,
      excludeFromExport: true,
    });
    (this.cropRect as any)._rpCropRect = true;

    // Add rule-of-thirds lines inside the crop rect
    this.addGridLines();

    this.canvas.add(this.overlay);
    this.canvas.add(this.cropRect);
    this.canvas.setActiveObject(this.cropRect);

    // Constrain crop rect movement to image bounds
    this.cropRect.on('moving', () => this.constrainCropRect());
    this.cropRect.on('scaling', () => this.constrainCropScale());
    this.canvas.renderAll();
  }

  /**
   * Deactivate crop mode and remove overlays
   */
  deactivate(): void {
    this.isActive = false;
    // Remove all crop-related objects
    const toRemove = this.canvas.getObjects().filter(
      (obj: any) => obj._rpCropRect || obj._rpOverlay || obj._rpCropGrid
    );
    toRemove.forEach((obj: fabric.Object) => this.canvas.remove(obj));
    this.cropRect = null;
    this.overlay = null;
    this.imageObject = null;
    this.canvas.renderAll();
  }

  /**
   * Apply the crop — returns cropped image data URL plus the geometry
   * needed by the caller to keep annotations aligned after the base
   * image is replaced.
   *
   *   cropRectCanvas — bounding box of the crop rect in the OLD canvas
   *                    coordinate system (post-scale).
   *   oldDisplayScaleX/Y — the base image's display scale at crop time
   *                        (canvas-pixels per image-pixel).
   */
  applyCrop(): {
    dataUrl: string;
    width: number;
    height: number;
    cropRectCanvas: { left: number; top: number; width: number; height: number };
    oldDisplayScaleX: number;
    oldDisplayScaleY: number;
  } | null {
    if (!this.cropRect || !this.imageObject) return null;

    const rect = this.cropRect;
    const img = this.imageObject;

    // Get crop rect position relative to the image
    const imgBounds = this.getImageBounds();
    const scaleX = (img as any).scaleX || 1;
    const scaleY = (img as any).scaleY || 1;

    // Crop rect bbox in canvas coords (post-scale)
    const rectCanvasW = (rect.width || 0) * (rect.scaleX || 1);
    const rectCanvasH = (rect.height || 0) * (rect.scaleY || 1);
    const cropRectCanvas = {
      left: rect.left || 0,
      top: rect.top || 0,
      width: rectCanvasW,
      height: rectCanvasH,
    };

    // Calculate crop coordinates in original image space
    const cropX = ((rect.left! - imgBounds.left) / scaleX);
    const cropY = ((rect.top! - imgBounds.top) / scaleY);
    const cropW = (rect.width! * (rect.scaleX || 1)) / scaleX;
    const cropH = (rect.height! * (rect.scaleY || 1)) / scaleY;

    // Create a temporary canvas to extract cropped area
    const tempCanvas = document.createElement('canvas');
    const w = Math.round(cropW);
    const h = Math.round(cropH);
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const imgElement = img.getElement() as HTMLImageElement;
    ctx.drawImage(
      imgElement,
      Math.round(cropX), Math.round(cropY), w, h,
      0, 0, w, h
    );

    const dataUrl = tempCanvas.toDataURL('image/png');

    // Cleanup
    this.deactivate();
    tempCanvas.width = 1;
    tempCanvas.height = 1;

    return {
      dataUrl,
      width: w,
      height: h,
      cropRectCanvas,
      oldDisplayScaleX: scaleX,
      oldDisplayScaleY: scaleY,
    };
  }

  /**
   * Set the crop aspect ratio.
   *
   * Bug fix: previously this kept the current rect width and derived
   * `height = width / ratio` without checking whether the derived height
   * still fit inside the image bounds. Picking e.g. 4:3 on a 16:9 photo
   * produced a rect that overflowed the image vertically — `constrainCropRect`
   * only clamps position, not size, so the overflow stayed and `Apply Crop`
   * exported an image with blank strips. The result didn't look like the
   * chosen aspect ratio.
   *
   * Now we shrink (w, h) proportionally so BOTH dimensions fit the image
   * while exactly matching `ratio`, and we re-centre the rect on its
   * previous centre so changing the ratio feels stable.
   */
  setAspectRatio(ratio: number | null): void {
    this.aspectRatio = ratio;
    if (this.cropRect && ratio !== null) {
      const bounds = this.getImageBounds();

      // Start from current rect width and derive a matching height.
      let newW = this.cropRect.width! * (this.cropRect.scaleX || 1);
      let newH = newW / ratio;

      // Fit (newW, newH) inside the image bounds while preserving the ratio.
      if (newW > bounds.width) {
        newW = bounds.width;
        newH = newW / ratio;
      }
      if (newH > bounds.height) {
        newH = bounds.height;
        newW = newH * ratio;
      }

      // Keep the rect roughly centred on its previous centre.
      const prevCx = (this.cropRect.left ?? 0)
        + (this.cropRect.width! * (this.cropRect.scaleX || 1)) / 2;
      const prevCy = (this.cropRect.top ?? 0)
        + (this.cropRect.height! * (this.cropRect.scaleY || 1)) / 2;

      this.cropRect.set({
        left: prevCx - newW / 2,
        top: prevCy - newH / 2,
        width: newW,
        height: newH,
        scaleX: 1,
        scaleY: 1,
      });

      // Hide side handles while a ratio is locked — only corner handles
      // can keep the ratio consistent. Side drags would otherwise appear
      // broken because `constrainCropScale` snaps the rect back to ratio.
      this.cropRect.setControlsVisibility({
        mt: false, mb: false, ml: false, mr: false,
      });

      this.constrainCropRect();
      this.canvas.renderAll();
    } else if (this.cropRect) {
      // Unlock aspect ratio — reset to uniform controls
      this.cropRect.setControlsVisibility({
        mt: true, mb: true, ml: true, mr: true,
      });
      this.canvas.renderAll();
    }
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  private getImageBounds(): { left: number; top: number; width: number; height: number } {
    if (!this.imageObject) {
      return { left: 0, top: 0, width: this.canvas.getWidth(), height: this.canvas.getHeight() };
    }
    const img = this.imageObject;
    const scaleX = (img as any).scaleX || 1;
    const scaleY = (img as any).scaleY || 1;
    return {
      left: img.left || 0,
      top: img.top || 0,
      width: (img.width || 0) * scaleX,
      height: (img.height || 0) * scaleY,
    };
  }

  private constrainCropRect(): void {
    if (!this.cropRect || !this.imageObject) return;
    const bounds = this.getImageBounds();
    const rect = this.cropRect;
    const w = rect.width! * (rect.scaleX || 1);
    const h = rect.height! * (rect.scaleY || 1);

    let left = rect.left!;
    let top = rect.top!;

    left = Math.max(bounds.left, Math.min(left, bounds.left + bounds.width - w));
    top = Math.max(bounds.top, Math.min(top, bounds.top + bounds.height - h));

    rect.set({ left, top });
    rect.setCoords();
  }

  private constrainCropScale(): void {
    if (!this.cropRect || !this.imageObject) return;
    const bounds = this.getImageBounds();
    const rect = this.cropRect;

    let w = rect.width! * (rect.scaleX || 1);
    let h = rect.height! * (rect.scaleY || 1);

    // Minimum size
    w = Math.max(this.minCropSize, w);
    h = Math.max(this.minCropSize, h);

    // Max size
    w = Math.min(w, bounds.width);
    h = Math.min(h, bounds.height);

    // Maintain aspect ratio if set
    if (this.aspectRatio !== null) {
      if (w / h > this.aspectRatio) {
        w = h * this.aspectRatio;
      } else {
        h = w / this.aspectRatio;
      }
    }

    rect.set({
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
    });
    this.constrainCropRect();
  }

  private addGridLines(): void {
    if (!this.cropRect) return;
    // Grid lines will be drawn during render — for now we use the crop rect's visual
    // A more advanced version could use fabric.Line objects that follow the crop rect
  }
}
