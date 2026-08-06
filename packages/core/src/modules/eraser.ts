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
    // Callout parts are removed as a group by the editor's brush eraser (which
    // does a per-pixel test on the tail so the full-canvas tail bitmap doesn't
    // get erased on any click over the image). They must be made
    // non-interactive here: if the box/anchor stay selectable+evented, pressing
    // the box starts a Fabric move-transform, and after the brush eraser
    // removes the callout the drag fires the box 'moving' handler → redrawTail()
    // → canvas.sendToBack(tail), which re-inserts the just-erased tail. That
    // leaves the tail behind while the box is gone. The brush eraser locates
    // callouts by coordinate hit-testing, so it doesn't need them evented.
    this.canvas.getObjects().forEach((obj: any) => {
      if (!obj._rpAnnotation) return;
      if (obj.calloutId != null) {
        obj.selectable = false;
        obj.evented = false;
        return;
      }
      if (obj._rpType !== 'draw') {
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

    // Restore callout part interactivity that activate() locked. Only the box
    // and anchor are interactive; the label/border/tail stay non-evented (their
    // normal resting state). The next mode re-applies its own locking on top of
    // this (e.g. move mode locks everything, callout mode re-enforces).
    this.canvas.getObjects().forEach((obj: any) => {
      if (obj._rpAnnotation && obj.calloutId != null) {
        const interactive =
          obj.calloutRole === 'bgRect' || obj.calloutRole === 'anchor';
        obj.selectable = interactive;
        obj.evented = interactive;
      }
    });

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
