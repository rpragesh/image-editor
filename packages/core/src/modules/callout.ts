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
  private boundsProvider:
    | (() => { left: number; top: number; right: number; bottom: number } | null)
    | null = null;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  /* ═══════════════════ public API ═══════════════════ */

  activate(): void {
    this.isActive = true;
    this.pendingAdd = true;
    this.canvas.isDrawingMode = false;
    this.canvas.defaultCursor = 'crosshair';
    this.restoreExistingCalloutInteractivity();
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

  setPlacementBoundsProvider(
    provider: (() => { left: number; top: number; right: number; bottom: number } | null) | null,
  ): void {
    this.boundsProvider = provider;
  }

  private getBounds(): { left: number; top: number; right: number; bottom: number } | null {
    return this.boundsProvider?.() || null;
  }

  private clampPointToBounds(x: number, y: number): { x: number; y: number } {
    const b = this.getBounds();
    if (!b) return { x, y };
    return {
      x: Math.max(b.left, Math.min(b.right, x)),
      y: Math.max(b.top, Math.min(b.bottom, y)),
    };
  }

  private isPointInsideBounds(x: number, y: number): boolean {
    const b = this.getBounds();
    if (!b) return true;
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }

  private clampCalloutIntoBounds(h: CalloutHandle): void {
    const b = this.getBounds();
    if (!b) return;

    const sx = h.bgRect.scaleX || 1;
    const sy = h.bgRect.scaleY || 1;
    const w = (h.bgRect.width || 0) * sx;
    const hgt = (h.bgRect.height || 0) * sy;

    let left = h.bgRect.left || 0;
    let top = h.bgRect.top || 0;
    const minLeft = b.left;
    const maxLeft = b.right - w;
    const minTop = b.top;
    const maxTop = b.bottom - hgt;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;
    h.bgRect.set({ left, top });
    h.bgRect.setCoords();

    this.syncBoxParts(h);

    const clampedAnchor = this.clampPointToBounds(
      h.anchor.left || 0,
      h.anchor.top || 0,
    );
    h.anchor.set({ left: clampedAnchor.x, top: clampedAnchor.y });
    h.anchor.setCoords();
  }

  /**
   * Move mode intentionally freezes all annotation objects; when the user
   * switches back to callout mode, previously placed callouts must be
   * re-enabled so they can be selected and edited again.
   */
  private restoreExistingCalloutInteractivity(): void {
    for (const h of this.callouts) {
      this.enforceCalloutPartLocks(h);
    }
    this.canvas.requestRenderAll();
  }

  /**
   * Rebuild internal callout handles from existing canvas objects.
   * Needed after loadFromJSON (undo/redo) because runtime references,
   * listeners and non-serialized interaction locks are not preserved.
   */
  rehydrateFromCanvas(): void {
    const byId = new Map<number, Partial<CalloutHandle>>();

    const objs = this.canvas.getObjects() as any[];
    for (const obj of objs) {
      const id = obj?.calloutId;
      const role = obj?.calloutRole;
      if (id == null || role == null) continue;

      if (!byId.has(id)) byId.set(id, { calloutId: id });
      const slot = byId.get(id)!;

      switch (role) {
        case 'bgRect':
          slot.bgRect = obj as fabric.Rect;
          break;
        case 'border':
          slot.border = obj as fabric.Rect;
          break;
        case 'label':
          slot.label = obj as fabric.IText;
          break;
        case 'anchor':
          slot.anchor = obj as fabric.Circle;
          break;
        case 'tail':
          slot.tailImage = obj as fabric.Image;
          break;
        default:
          break;
      }
    }

    this.callouts = [];
    let maxId = 0;

    for (const [id, partial] of byId.entries()) {
      const bgRect = partial.bgRect;
      const border = partial.border;
      const label = partial.label;
      const anchor = partial.anchor;
      const tailImage = partial.tailImage;
      if (!bgRect || !border || !label || !anchor || !tailImage) continue;

      const tailCanvas = document.createElement('canvas');
      tailCanvas.width = this.canvas.getWidth();
      tailCanvas.height = this.canvas.getHeight();

      const textW = label.getScaledWidth();
      const textH = label.getScaledHeight();
      const rectW = (bgRect.width || 0) * (bgRect.scaleX || 1);
      const rectH = (bgRect.height || 0) * (bgRect.scaleY || 1);
      const paddingH = Math.max(0, (rectW - textW) / 2);
      const paddingV = Math.max(0, (rectH - textH) / 2);

      const handle: CalloutHandle = {
        calloutId: id,
        bgRect,
        border,
        label,
        anchor,
        tailCanvas,
        tailImage,
        color: String((bgRect as any).fill || this.calloutColor),
        paddingH,
        paddingV,
        labelNaturalW: textW,
        labelNaturalH: textH,
      };

      this.enforceCalloutPartLocks(handle);
      this.wireHandleEvents(handle);
      this.redrawTail(handle);

      this.callouts.push(handle);
      if (id > maxId) maxId = id;
    }

    this.calloutCounter = Math.max(this.calloutCounter, maxId);
    this.canvas.requestRenderAll();
  }

  /** Returns the number of callouts currently on the canvas */
  getCalloutCount(): number {
    return this.callouts.length;
  }

  /**
   * Test whether any callout visually intersects a circle at (x, y) with
   * the given radius (in canvas coordinates). The box, border, label and
   * anchor are hit-tested by inflated bounding rect; the tail is
   * hit-tested per-pixel against its off-screen bitmap so the
   * full-canvas-sized tail image doesn't produce false positives on
   * every click. Returns the calloutId of the first hit, or null.
   */
  getCalloutIdAtPoint(x: number, y: number, radius: number): number | null {
    const r = Math.max(0, radius);
    for (const h of this.callouts) {
      const parts: fabric.Object[] = [h.bgRect, h.border, h.label, h.anchor];
      let hit = false;
      for (const p of parts) {
        const b = p.getBoundingRect(true, true);
        if (
          x >= b.left - r &&
          x <= b.left + b.width + r &&
          y >= b.top - r &&
          y <= b.top + b.height + r
        ) {
          hit = true;
          break;
        }
      }
      if (hit || this.tailHitTest(h, x, y, r)) {
        return h.calloutId;
      }
    }
    return null;
  }

  /**
   * Per-pixel alpha test against the tail's off-screen bitmap around
   * (x, y) within the eraser radius. Returns true if any non-transparent
   * pixel is found in the sampled region.
   */
  private tailHitTest(
    h: CalloutHandle,
    x: number,
    y: number,
    radius: number,
  ): boolean {
    const c = h.tailCanvas;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const r = Math.max(1, Math.round(radius));
    const sx = Math.max(0, Math.floor(x - r));
    const sy = Math.max(0, Math.floor(y - r));
    const w = Math.min(c.width - sx, r * 2 + 1);
    const hgt = Math.min(c.height - sy, r * 2 + 1);
    if (w <= 0 || hgt <= 0) return false;
    try {
      const data = ctx.getImageData(sx, sy, w, hgt).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
    } catch {
      // getImageData may throw if the canvas becomes tainted; treat as miss
    }
    return false;
  }

  /**
   * Remove all fabric objects belonging to a callout (tail, border, box,
   * label, anchor) and drop the internal handle. Returns true if a
   * callout with that id was found and removed.
   */
  removeCalloutById(id: number): boolean {
    const idx = this.callouts.findIndex((h) => h.calloutId === id);
    if (idx === -1) return false;
    const h = this.callouts[idx];
    this.canvas.remove(h.tailImage);
    this.canvas.remove(h.border);
    this.canvas.remove(h.bgRect);
    this.canvas.remove(h.label);
    this.canvas.remove(h.anchor);
    this.callouts.splice(idx, 1);
    return true;
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
    this.clampCalloutIntoBounds(handle);
    this.redrawTail(handle);

    this.wireHandleEvents(handle);

    // Auto-show controls and select the rect
    border.set({ visible: true });
    anchor.set({ visible: true });
    this.canvas.setActiveObject(bgRect);
    this.canvas.renderAll();

    // Signal a single logical create operation after all parts are on-canvas.
    this.canvas.fire('rp:callout:created', { calloutId: id });
  }

  /**
   * Re-apply interaction constraints for each callout part.
   */
  private enforceCalloutPartLocks(h: CalloutHandle): void {
    h.bgRect.set({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: false,
      lockRotation: true,
      hoverCursor: 'move',
    });

    h.border.set({
      selectable: false,
      evented: false,
      visible: false,
    });

    h.label.set({
      selectable: false,
      evented: false,
      editable: true,
      originX: 'left',
      originY: 'top',
    });

    h.anchor.set({
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
      visible: false,
    });

    h.tailImage.set({
      selectable: false,
      evented: false,
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
    });

    h.bgRect.setCoords();
    h.border.setCoords();
    h.label.setCoords();
    h.anchor.setCoords();
    h.tailImage.setCoords();
  }

  /**
   * Attach callout interaction listeners.
   */
  private wireHandleEvents(handle: CalloutHandle): void {
    const { bgRect, border, label, anchor } = handle;

    bgRect.off('moving');
    bgRect.off('scaling');
    anchor.off('moving');
    label.off('changed');
    bgRect.off('mousedblclick');
    bgRect.off('mousedown');
    label.off('editing:exited');
    bgRect.off('selected');
    label.off('selected');
    anchor.off('selected');
    bgRect.off('deselected');
    label.off('deselected');
    anchor.off('deselected');

    bgRect.on('moving', () => {
      this.clampCalloutIntoBounds(handle);
      this.syncBoxParts(handle);
      this.redrawTail(handle);
    });

    bgRect.on('scaling', () => {
      this.clampBoxSize(handle);
      this.clampCalloutIntoBounds(handle);
      this.syncBoxParts(handle);
      this.redrawTail(handle);
    });

    anchor.on('moving', () => {
      const p = this.clampPointToBounds(anchor.left || 0, anchor.top || 0);
      anchor.set({ left: p.x, top: p.y });
      anchor.setCoords();
      this.redrawTail(handle);
    });

    label.on('changed', () => {
      this.resizeBoxToFitLabel(handle);
      this.redrawTail(handle);
    });

    bgRect.on('mousedblclick', () => {
      this.enterLabelEditing(handle);
    });

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

    label.on('editing:exited', () => {
      this.onLabelEditingExited(handle);
    });

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
      setTimeout(() => {
        const active = this.canvas.getActiveObject();
        if (active !== bgRect && active !== label && active !== anchor) {
          hideControls();
        }
      }, 100);
    });
    anchor.on('deselected', () => {
      setTimeout(() => {
        const active = this.canvas.getActiveObject();
        if (active !== bgRect && active !== label && active !== anchor) {
          hideControls();
        }
      }, 100);
    });
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
      tailImage.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, dirty: true });
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
    tailImage.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, dirty: true });

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
    if (!this.isPointInsideBounds(pointer.x, pointer.y)) return;
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
