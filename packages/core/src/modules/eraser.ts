/**
 * Eraser Module — erase annotations
 * Uses object-tap-to-delete approach for reliability across platforms
 */
import { fabric } from 'fabric';

export class EraserModule {
  private canvas: fabric.Canvas;
  private isActive = false;
  private eraserWidth = 20;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  /**
  * Activate eraser mode — tapping on selectable annotations removes them.
  * Freehand draw paths stay non-selectable and are erased by the
  * editor-level brush hit-test path.
   */
  activate(): void {
    this.isActive = true;
    this.canvas.isDrawingMode = false;
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.selection = false;

    // Make all annotation objects selectable but with delete-on-click behavior.
    // Skip callout parts — they are removed as a group by the editor's brush
    // eraser (which does a per-pixel test on the tail so the full-canvas tail
    // bitmap doesn't get erased on any click over the image).
    this.canvas.getObjects().forEach((obj: any) => {
      if (obj._rpAnnotation && obj.calloutId == null && obj._rpType !== 'draw') {
        obj.selectable = true;
        obj.evented = true;
        obj.hoverCursor = 'pointer';
      }
    });

    this.canvas.on('mouse:down', this.handleEraserClick);
  }

  /**
   * Deactivate eraser mode
   */
  deactivate(): void {
    this.isActive = false;
    this.canvas.defaultCursor = 'default';
    this.canvas.selection = true;
    this.canvas.off('mouse:down', this.handleEraserClick);
  }

  /**
   * Set eraser brush width (visual indicator on hover)
   */
  setEraserWidth(width: number): void {
    this.eraserWidth = Math.max(5, Math.min(100, width));
  }

  getEraserWidth(): number {
    return this.eraserWidth;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  private handleEraserClick = (opt: fabric.IEvent): void => {
    if (!this.isActive) return;

    const target = opt.target as any;
    // Callout parts are handled by the editor's brush eraser (which does a
    // per-pixel test on the tail bitmap). Ignore them here so a click that
    // happens to hit the full-canvas tail image doesn't wipe out the callout.
    if (target && target._rpAnnotation && target.calloutId == null) {
      // Remove the annotation object
      this.canvas.remove(target);
      this.canvas.renderAll();
    }
  };
}
