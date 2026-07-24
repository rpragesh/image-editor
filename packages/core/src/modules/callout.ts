/**
 * Callout Module — add callout annotations with an editable label and a
 * draggable tail pointer (like markerjs CalloutMarker).
 *
 * Architecture (all separate Fabric objects, no Group):
 *   1. tailImage  — filled triangle rendered via off-screen canvas
 *   2. bgRect     — colored rounded rectangle behind the text
 *   3. border     — dashed selection border around bgRect
 *   4. label      — fabric.IText so the user can click (desktop) or
 *                   double-tap (mobile) to edit inline
 *   5. anchor     — small draggable circle at the tail tip
 *
 * Moving the rect drags border + label along and redraws the tail.
 * Moving the anchor redraws only the tail.
 * Text constraints (max 40 chars, word-wrap at ~15 chars) are enforced
 * when the user finishes editing.
 * The box cannot be resized smaller than the label's natural size + minimum padding.
 */
import { fabric } from 'fabric';

export interface CalloutOptions {
  text?: string;
  color?: string;
  textColor?: string;
  fontSize?: number;
  left?: number;
  top?: number;
  anchorLeft?: number;
  anchorTop?: number;
  /** Maximum characters allowed in a callout label (default 40) */
  maxChars?: number;
  /** Character position around which to insert a line-break (default 15) */
  lineBreakAt?: number;
}

/** Internal bookkeeping for one callout on the canvas */
interface CalloutHandle {
  calloutId: number;
  bgRect: fabric.Rect;
  border: fabric.Rect;
  label: fabric.IText;
  anchor: fabric.Circle;
  tailCanvas: HTMLCanvasElement;
  tailImage: fabric.Image;
  color: string;
  paddingH: number;
  paddingV: number;
  /** Intrinsic (unscaled) label width — cached to avoid floating-point drift */
  labelNaturalW: number;
  /** Intrinsic (unscaled) label height */
  labelNaturalH: number;
}

export class CalloutModule {
  private canvas: fabric.Canvas;
  private isActive = false;
  private pendingAdd = false;
  private calloutColor = '#ff0000';
  private calloutTextColor = '#ffffff';
  private fontSize = 20;
  private callouts: CalloutHandle[] = [];
  private calloutCounter = 0;

  /** Max characters allowed in a callout label */
  private calloutMaxChars = 40;
  /** Character position around which to insert a line-break */
  private calloutLineBreakAt = 15;
  /** Initial text used for newly-placed callouts */
  private defaultText = 'Label';

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  /* ═══════════════════ public API ═══════════════════ */

  activate(): void {
    this.isActive = true;
    this.pendingAdd = true;
    this.canvas.isDrawingMode = false;
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.on('mouse:down', this.handleCanvasClick);
  }

  deactivate(): void {
    this.isActive = false;
    this.pendingAdd = false;
    this.canvas.defaultCursor = 'default';
    this.canvas.off('mouse:down', this.handleCanvasClick);
  }

  setColor(color: string): void {
    this.calloutColor = color;

    // If a callout is currently selected (any of its parts — box, label,
    // anchor), recolor it live so the color palette behaves the same way
    // the shape module does when a shape is selected.
    const active = this.canvas.getActiveObject() as any;
    if (!active) return;

    const targetIds = new Set<number>();
    if (active.type === 'activeSelection') {
      (active as fabric.ActiveSelection).forEachObject((obj: any) => {
        if (obj.calloutId != null) targetIds.add(obj.calloutId);
      });
    } else if (active.calloutId != null) {
      targetIds.add(active.calloutId);
    }
    if (targetIds.size === 0) return;

    for (const h of this.callouts) {
      if (!targetIds.has(h.calloutId)) continue;
      h.color = color;
      h.bgRect.set({ fill: color });
      this.redrawTail(h);
    }
    this.canvas.requestRenderAll();
  }

  setTextColor(color: string): void {
    this.calloutTextColor = color;
  }

  setFontSize(size: number): void {
    this.fontSize = Math.max(8, Math.min(200, size));
  }

  /**
   * Update the defaults used for newly-placed callouts. Existing
   * callouts on the canvas are not modified. All keys are optional;
   * omitted keys keep their current value.
   */
  setDefaults(defaults: {
    text?: string;
    maxChars?: number;
    lineBreakAt?: number;
  }): void {
    if (typeof defaults.text === 'string') {
      this.defaultText = defaults.text;
    }
    if (typeof defaults.maxChars === 'number' && defaults.maxChars > 0) {
      this.calloutMaxChars = defaults.maxChars;
    }
    if (
      typeof defaults.lineBreakAt === 'number' &&
      defaults.lineBreakAt > 0
    ) {
      this.calloutLineBreakAt = defaults.lineBreakAt;
    }
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  /** Returns the number of callouts currently on the canvas */
  getCalloutCount(): number {
    return this.callouts.length;
  }

  /**
   * Delete the currently selected callout (if any).
   * Removes all 5 fabric objects belonging to that callout.
   * Returns true if something was deleted.
   */
  deleteSelected(): boolean {
    const activeObj = this.canvas.getActiveObject() as any;
    if (!activeObj) return false;

    const idsToRemove = new Set<number>();

    if (activeObj.type === 'activeSelection') {
      (activeObj as fabric.ActiveSelection).forEachObject((obj: any) => {
        if (obj.calloutId != null) idsToRemove.add(obj.calloutId);
        else this.canvas.remove(obj);
      });
    } else {
      if (activeObj.calloutId != null) {
        idsToRemove.add(activeObj.calloutId);
      } else {
        // Not a callout object — remove directly (e.g. a draw path)
        this.canvas.remove(activeObj);
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        return true;
      }
    }

    if (idsToRemove.size > 0) {
      const allObjects = this.canvas.getObjects() as any[];
      const toRemove = allObjects.filter((o: any) => idsToRemove.has(o.calloutId));
      toRemove.forEach((o) => this.canvas.remove(o));
      this.callouts = this.callouts.filter((h) => !idsToRemove.has(h.calloutId));
    }

    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    return idsToRemove.size > 0;
  }

  /**
   * Hide all callout borders and anchors (call before export).
   */
  hideAllControls(): void {
    for (const h of this.callouts) {
      h.border.set({ visible: false });
      h.anchor.set({ visible: false });
    }
  }

  /**
   * Refresh every callout's tail bitmap — needed after operations
   * (like crop) that change the underlying canvas dimensions, since the
   * tail is rendered onto an off-screen canvas sized to the main canvas.
   */
  refreshAllTails(): void {
    for (const h of this.callouts) {
      this.redrawTail(h);
    }
    this.canvas.requestRenderAll();
  }

  /**
   * Show borders and anchors only for currently-selected callouts.
   * Call after export to restore interactive state.
   */
  showAllControls(): void {
    const active = this.canvas.getActiveObject() as any;
    for (const h of this.callouts) {
      const isSelected =
        active &&
        (active === h.bgRect ||
          active === h.label ||
          active === h.anchor ||
          active.calloutId === h.calloutId);
      h.border.set({ visible: !!isSelected });
      h.anchor.set({ visible: !!isSelected });
    }
  }

  /* ═══════════════════ addCallout ═══════════════════ */

  addCallout(opts?: CalloutOptions): void {
    const color = opts?.color || this.calloutColor;
    const textColor = opts?.textColor || this.calloutTextColor;
    const fontSize = opts?.fontSize || this.fontSize;
    const rawText = opts?.text || this.defaultText;
    const labelText = this.formatCalloutText(
      rawText,
      opts?.maxChars,
      opts?.lineBreakAt,
    );

    const id = ++this.calloutCounter;
    const paddingH = 22;
    const paddingV = 14;

    // ── 1. Editable label (IText) — measure first ──
    const label = new fabric.IText(labelText, {
      fontSize,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontWeight: '600',
      fill: textColor,
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      editable: true,
      padding: 0,
    });
    (label as any)._rpAnnotation = true;
    (label as any)._rpType = 'callout-label';
    (label as any).calloutId = id;
    (label as any).calloutRole = 'label';

    const textW = label.getScaledWidth();
    const textH = label.getScaledHeight();
    const rectW = textW + paddingH * 2;
    const rectH = textH + paddingV * 2;

    // Box position
    const boxLeft = opts?.left ?? this.canvas.getWidth() / 2 - rectW / 2;
    const boxTop = opts?.top ?? this.canvas.getHeight() / 2 - rectH / 2 - 50;

    // ── 2. Background rect ──
    const bgRect = new fabric.Rect({
      left: boxLeft,
      top: boxTop,
      width: rectW,
      height: rectH,
      fill: color,
      rx: 8,
      ry: 8,
      originX: 'left',
      originY: 'top',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: false,
      cornerColor: '#0ea5e9',
      cornerStyle: 'circle',
      cornerSize: 8,
      transparentCorners: false,
      lockRotation: true,
      hoverCursor: 'move',
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.25)',
        blur: 8,
        offsetX: 0,
        offsetY: 4,
      }),
    });
    (bgRect as any)._rpAnnotation = true;
    (bgRect as any)._rpType = 'callout-box';
    (bgRect as any).calloutId = id;
    (bgRect as any).calloutRole = 'bgRect';

    // ── 3. Dashed border ──
    const borderPad = 3;
    const border = new fabric.Rect({
      left: boxLeft - borderPad,
      top: boxTop - borderPad,
      width: rectW + borderPad * 2,
      height: rectH + borderPad * 2,
      fill: 'transparent',
      stroke: '#ffffff',
      strokeDashArray: [5, 3],
      strokeWidth: 1.5,
      rx: 5,
      ry: 5,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      visible: false,
    });
    (border as any)._rpAnnotation = true;
    (border as any)._rpType = 'callout-border';
    (border as any).calloutId = id;
    (border as any).calloutRole = 'border';

    // Position the label inside the rect
    label.set({
      left: boxLeft + paddingH,
      top: boxTop + paddingV,
    });

    // ── 4. Anchor (tail tip) ──
    const anchorLeft = opts?.anchorLeft ?? boxLeft + rectW * 0.3;
    const anchorTop = opts?.anchorTop ?? boxTop + rectH + 80;

    const anchor = new fabric.Circle({
      radius: 7,
      fill: '#0ea5e9',
      stroke: '#ffffff',
      strokeWidth: 2,
      left: anchorLeft,
      top: anchorTop,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
      visible: false,
    });
    (anchor as any)._rpAnnotation = true;
    (anchor as any)._rpType = 'callout-anchor';
    (anchor as any).calloutId = id;
    (anchor as any).calloutRole = 'anchor';

    // ── 5. Tail — off-screen canvas rendered as fabric.Image ──
    const tailCanvas = document.createElement('canvas');
    tailCanvas.width = this.canvas.getWidth();
    tailCanvas.height = this.canvas.getHeight();

    const tailImage = new fabric.Image(tailCanvas, {
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
    });
    (tailImage as any)._rpAnnotation = true;
    (tailImage as any)._rpType = 'callout-tail';
    (tailImage as any).calloutId = id;
    (tailImage as any).calloutRole = 'tail';

    // ── Build handle ──
    const handle: CalloutHandle = {
      calloutId: id,
      bgRect,
      border,
      label,
      anchor,
      tailCanvas,
      tailImage,
      color,
      paddingH,
      paddingV,
      labelNaturalW: textW,
      labelNaturalH: textH,
    };
    this.callouts.push(handle);

    // ── Add objects in z-order: tail → border → rect → label → anchor ──
    this.canvas.add(tailImage);
    this.canvas.add(border);
    this.canvas.add(bgRect);
    this.canvas.add(label);
    this.canvas.add(anchor);

    // Initial tail draw
    this.redrawTail(handle);

    // ── Wire up events ──

    // Dragging the box → move border + label along, redraw tail
    bgRect.on('moving', () => {
      this.syncBoxParts(handle);
      this.redrawTail(handle);
    });

    bgRect.on('scaling', () => {
      this.clampBoxSize(handle);
      this.syncBoxParts(handle);
      this.redrawTail(handle);
    });

    // Dragging the anchor → just redraw tail
    anchor.on('moving', () => {
      this.redrawTail(handle);
    });

    // Live resize while user is typing
    label.on('changed', () => {
      this.resizeBoxToFitLabel(handle);
      this.redrawTail(handle);
    });

    // ── Text editing triggers ──

    // Desktop: double-click on bgRect → focus label and enter editing
    bgRect.on('mousedblclick', () => {
      this.enterLabelEditing(handle);
    });

    // Mobile: double-tap detection on bgRect (touchend doesn't fire dblclick)
    let lastTapTime = 0;
    bgRect.on('mousedown', () => {
      const now = Date.now();
      if (now - lastTapTime < 350) {
        this.enterLabelEditing(handle);
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    });

    // When the user finishes editing, enforce text constraints
    label.on('editing:exited', () => {
      this.onLabelEditingExited(handle);
    });

    // Show/hide border + anchor based on selection
    const showControls = () => {
      border.set({ visible: true });
      anchor.set({ visible: true });
      this.canvas.renderAll();
    };
    const hideControls = () => {
      border.set({ visible: false });
      anchor.set({ visible: false });
      this.canvas.renderAll();
    };

    bgRect.on('selected', showControls);
    label.on('selected', showControls);
    anchor.on('selected', showControls);

    bgRect.on('deselected', hideControls);
    label.on('deselected', () => {
      // Hide controls after a short delay to allow re-selection
      setTimeout(() => {
        const active = this.canvas.getActiveObject();
        if (active !== bgRect && active !== label && active !== anchor) {
          hideControls();
        }
      }, 100);
    });
    anchor.on('deselected', () => {
      // Only hide if nothing else in this callout is selected
      setTimeout(() => {
        const active = this.canvas.getActiveObject();
        if (active !== bgRect && active !== label && active !== anchor) {
          hideControls();
        }
      }, 100);
    });

    // Auto-show controls and select the rect
    border.set({ visible: true });
    anchor.set({ visible: true });
    this.canvas.setActiveObject(bgRect);
    this.canvas.renderAll();
  }

  /* ═══════════════ text constraint helpers ═══════════════ */

  /**
   * Truncate text to a maximum length, adding ellipsis if truncated.
   */
  private constrainText(text: string, max = this.calloutMaxChars): string {
    if (!text) return text;
    text = text.replace(/\n/g, ' '); // flatten any existing newlines
    if (text.length <= max) return text;
    return text.substring(0, max - 3) + '...';
  }

  /**
   * Insert a line-break (\n) near `breakAt` at the closest word boundary
   * so `fabric.IText` renders a compact two-line label.
   */
  private wrapText(text: string, breakAt = this.calloutLineBreakAt): string {
    if (!text || text.length <= breakAt) return text;
    // Already contains a manual line-break — leave as-is
    if (text.includes('\n')) return text;

    // Scan backwards from breakAt to find the nearest space
    let splitPos = -1;
    for (let i = breakAt; i >= 0; i--) {
      if (text[i] === ' ') {
        splitPos = i;
        break;
      }
    }
    // If no space found before breakAt, scan forward
    if (splitPos === -1) {
      for (let i = breakAt + 1; i < text.length; i++) {
        if (text[i] === ' ') {
          splitPos = i;
          break;
        }
      }
    }
    // Still no space — force break at breakAt
    if (splitPos === -1) splitPos = breakAt;

    return text.substring(0, splitPos).trim() + '\n' + text.substring(splitPos).trim();
  }

  /** Constrain + word-wrap a callout label in one step */
  private formatCalloutText(
    text: string,
    maxChars?: number,
    lineBreakAt?: number,
  ): string {
    return this.wrapText(
      this.constrainText(text, maxChars ?? this.calloutMaxChars),
      lineBreakAt ?? this.calloutLineBreakAt,
    );
  }

  /* ═══════════════ editing helpers ═══════════════════ */

  /** Focus the label IText and enter inline editing mode */
  private enterLabelEditing(h: CalloutHandle): void {
    // Temporarily make the label interactive so it can be focused
    h.label.selectable = true;
    h.label.evented = true;
    this.canvas.setActiveObject(h.label);
    h.label.enterEditing();
    h.label.selectAll();
    this.canvas.renderAll();
  }

  /** Called when the user finishes editing — enforce constraints, resize, re-lock label */
  private onLabelEditingExited(h: CalloutHandle): void {
    const raw = h.label.text || '';
    const formatted = this.formatCalloutText(raw);

    // Apply constrained text back (may differ from what user typed)
    if (formatted !== raw) {
      h.label.set({ text: formatted });
    }

    // Reset label scale to 1 so natural dimensions are correct
    h.label.set({ scaleX: 1, scaleY: 1 });

    // Update cached intrinsic dimensions
    h.labelNaturalW = h.label.getScaledWidth();
    h.labelNaturalH = h.label.getScaledHeight();

    // Resize box to fit new text
    this.resizeBoxToFitLabel(h);
    this.redrawTail(h);

    // Lock label again — it should only be interactable via bgRect selection
    h.label.selectable = false;
    h.label.evented = false;

    // Hide controls after a short delay to allow re-selection of bgRect
    setTimeout(() => {
      const active = this.canvas.getActiveObject();
      if (active !== h.bgRect && active !== h.label && active !== h.anchor) {
        h.border.set({ visible: false });
        h.anchor.set({ visible: false });
        this.canvas.renderAll();
      }
    }, 100);
  }

  /* ═══════════════ private geometry helpers ═══════════════════ */

  /** Prevent the box from being resized smaller than the label's natural size + minimum padding */
  private clampBoxSize(h: CalloutHandle): void {
    const { bgRect } = h;
    const minPadH = 14;
    const minPadV = 8;
    const minW = h.labelNaturalW + minPadH * 2;
    const minH = h.labelNaturalH + minPadV * 2;

    const sx = bgRect.scaleX || 1;
    const sy = bgRect.scaleY || 1;
    const currentW = (bgRect.width || 0) * sx;
    const currentH = (bgRect.height || 0) * sy;

    if (currentW < minW) {
      bgRect.set({ scaleX: minW / (bgRect.width || 1) });
    }
    if (currentH < minH) {
      bgRect.set({ scaleY: minH / (bgRect.height || 1) });
    }
    bgRect.setCoords();
  }

  /** Keep border + label in sync with bgRect position/size */
  private syncBoxParts(h: CalloutHandle): void {
    const { bgRect, border, label, paddingH, paddingV } = h;
    const bLeft = bgRect.left || 0;
    const bTop = bgRect.top || 0;
    const sx = bgRect.scaleX || 1;
    const sy = bgRect.scaleY || 1;
    const rw = (bgRect.width || 0) * sx;
    const rh = (bgRect.height || 0) * sy;

    const borderPad = 3;
    border.set({
      left: bLeft - borderPad,
      top: bTop - borderPad,
      width: rw + borderPad * 2,
      height: rh + borderPad * 2,
      scaleX: 1,
      scaleY: 1,
    });
    border.setCoords();

    // Use stored intrinsic dimensions so repeated scaling never drifts.
    const naturalW = h.labelNaturalW;
    const naturalH = h.labelNaturalH;
    const availW = rw - paddingH * 2;
    const availH = rh - paddingV * 2;
    // Clamp so the font never shrinks below its base size (scale >= 1)
    const uniformScale = Math.max(
      1,
      Math.min(availW / (naturalW || 1), availH / (naturalH || 1)),
    );

    // Center the label inside the box
    const scaledTextW = naturalW * uniformScale;
    const scaledTextH = naturalH * uniformScale;
    label.set({
      left: bLeft + (rw - scaledTextW) / 2,
      top: bTop + (rh - scaledTextH) / 2,
      scaleX: uniformScale,
      scaleY: uniformScale,
    });
    label.setCoords();
  }

  /** After text edit, resize bgRect + border to fit the new label */
  private resizeBoxToFitLabel(h: CalloutHandle): void {
    const { bgRect, border, label, paddingH, paddingV } = h;
    const tw = label.getScaledWidth();
    const th = label.getScaledHeight();
    const newW = tw + paddingH * 2;
    const newH = th + paddingV * 2;

    const bLeft = bgRect.left || 0;
    const bTop = bgRect.top || 0;

    bgRect.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 });
    bgRect.setCoords();

    const borderPad = 3;
    border.set({
      left: bLeft - borderPad,
      top: bTop - borderPad,
      width: newW + borderPad * 2,
      height: newH + borderPad * 2,
      scaleX: 1,
      scaleY: 1,
    });
    border.setCoords();

    label.set({ left: bLeft + paddingH, top: bTop + paddingV });
    label.setCoords();

    this.canvas.renderAll();
  }

  /**
   * Redraw the tail triangle from the rect edge to the anchor point.
   * Uses ray-rect intersection so the tail exits from the correct edge
   * regardless of where the anchor is (below, above, left, right).
   * The base is pulled slightly inside the box to eliminate the visual gap.
   */
  private redrawTail(h: CalloutHandle): void {
    const { bgRect, anchor, tailCanvas, tailImage, color } = h;

    const canvasW = this.canvas.getWidth();
    const canvasH = this.canvas.getHeight();

    if (tailCanvas.width !== canvasW || tailCanvas.height !== canvasH) {
      tailCanvas.width = canvasW;
      tailCanvas.height = canvasH;
    }

    const ctx = tailCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Box geometry
    const bLeft = bgRect.left || 0;
    const bTop = bgRect.top || 0;
    const sx = bgRect.scaleX || 1;
    const sy = bgRect.scaleY || 1;
    const rw = (bgRect.width || 0) * sx;
    const rh = (bgRect.height || 0) * sy;

    const boxCX = bLeft + rw / 2;
    const boxCY = bTop + rh / 2;

    const aX = anchor.left || 0;
    const aY = anchor.top || 0;

    // Direction to anchor
    const dx = aX - boxCX;
    const dy = aY - boxCY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      // Anchor inside box — no tail
      tailImage.setElement(tailCanvas as any);
      tailImage.set({ dirty: true });
      this.canvas.renderAll();
      return;
    }

    // Perpendicular for the base width
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const baseHalf = Math.min(Math.max(rw * 0.15, 10), 16);

    // Where the tail exits the rect edge
    const edgePoint = this.rayRectIntersection(
      boxCX,
      boxCY,
      dx,
      dy,
      bLeft,
      bTop,
      rw,
      rh,
    );

    // Move base slightly INSIDE the box to avoid visual gap
    const overlap = 25;
    const baseEdgeX = edgePoint.x - (dx / dist) * overlap;
    const baseEdgeY = edgePoint.y - (dy / dist) * overlap;

    const base1X = baseEdgeX + perpX * baseHalf;
    const base1Y = baseEdgeY + perpY * baseHalf;
    const base2X = baseEdgeX - perpX * baseHalf;
    const base2Y = baseEdgeY - perpY * baseHalf;

    // Draw the filled triangle
    ctx.beginPath();
    ctx.moveTo(base1X, base1Y);
    ctx.lineTo(base2X, base2Y);
    ctx.lineTo(aX, aY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fill();

    tailImage.setElement(tailCanvas as any);
    tailImage.set({ dirty: true });

    // Z-order: tail behind box parts, base image behind everything
    this.canvas.sendToBack(tailImage);
    const baseImg = this.canvas.getObjects().find((o: any) => o._rpBaseImage);
    if (baseImg) this.canvas.sendToBack(baseImg);

    this.canvas.renderAll();
  }

  /**
   * Find where a ray from (ox,oy) in direction (dx,dy) exits the rect.
   */
  private rayRectIntersection(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ): { x: number; y: number } {
    let tMin = Infinity;
    let hitX = ox;
    let hitY = oy;

    const checks = [
      { t: dy !== 0 ? (ry - oy) / dy : Infinity }, // top
      { t: dy !== 0 ? (ry + rh - oy) / dy : Infinity }, // bottom
      { t: dx !== 0 ? (rx - ox) / dx : Infinity }, // left
      { t: dx !== 0 ? (rx + rw - ox) / dx : Infinity }, // right
    ];

    for (const c of checks) {
      if (c.t > 0.001 && c.t < tMin) {
        const px = ox + dx * c.t;
        const py = oy + dy * c.t;
        if (
          px >= rx - 1 &&
          px <= rx + rw + 1 &&
          py >= ry - 1 &&
          py <= ry + rh + 1
        ) {
          tMin = c.t;
          hitX = px;
          hitY = py;
        }
      }
    }

    return { x: hitX, y: hitY };
  }

  /** Canvas click handler — place a new callout */
  private handleCanvasClick = (opt: fabric.IEvent): void => {
    if (!this.pendingAdd) return;
    if (opt.target) return;

    const pointer = this.canvas.getPointer(opt.e);
    this.addCallout({
      left: pointer.x - 60,
      top: pointer.y - 100,
      anchorLeft: pointer.x,
      anchorTop: pointer.y,
    });

    this.pendingAdd = false;
    // Don't re-enable — user must click the Callout toolbar button again to add another
  };
}
