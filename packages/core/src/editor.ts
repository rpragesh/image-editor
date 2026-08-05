/**
 * RpImageEditor — Main editor class
 * Orchestrates the Fabric.js canvas with all editing modules
 */
import { fabric } from 'fabric';
import {
  RpEditorConfig,
  RpEditorResult,
  RpEditorEvents,
  EditorMode,
  LoadedImageInfo,
  RpEditorTheme,
  ImageFilterPreset,
  ImageAdjustments,
} from './types/index.js';
import { mergeConfig } from './utils/defaults.js';
import { EventEmitter } from './utils/event-emitter.js';
import { processImage } from './utils/image-processing.js';
import { isTouchDevice } from './utils/platform.js';
import { CropModule } from './modules/crop.js';
import { DrawModule } from './modules/draw.js';
import { TextModule } from './modules/text.js';
import { EraserModule } from './modules/eraser.js';
import { CalloutModule } from './modules/callout.js';
import { ShapeModule } from './modules/shape.js';
import { HistoryModule } from './modules/history.js';
import { Toolbar, ToolbarCallbacks } from './ui/toolbar.js';
import { ensureShellStyles } from './ui/styles.js';
import { getLocalePack } from './i18n/index.js';
import type { LocalePack } from './i18n/types.js';

export class RpImageEditor extends EventEmitter<RpEditorEvents> {
  private static readonly MIN_ZOOM = 0.25;
  private static readonly MAX_ZOOM = 5;

  private config: ReturnType<typeof mergeConfig>;
  private localePack!: LocalePack;
  private container: HTMLElement;
  private wrapperEl: HTMLElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private fabricCanvas: fabric.Canvas | null = null;
  private baseImage: fabric.Image | null = null;
  private originalImageBlob: Blob | null = null;
  private imageInfo: LoadedImageInfo | null = null;

  // Modules
  private cropModule: CropModule | null = null;
  private drawModule: DrawModule | null = null;
  private textModule: TextModule | null = null;
  private eraserModule: EraserModule | null = null;
  private calloutModule: CalloutModule | null = null;
  private shapeModule: ShapeModule | null = null;
  private historyModule: HistoryModule | null = null;
  private toolbar: Toolbar | null = null;

  // State
  private currentMode: EditorMode = 'move';
  private zoomLevel = 1;
  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private isDestroyed = false;

  // Brush-eraser drag state — additive layer on top of the module's
  // click-to-delete behaviour so users can drag along a path to erase,
  // matching the drawing feel.
  private isErasing = false;
  private eraserDidRemove = false;
  private eraserCursorEl: HTMLDivElement | null = null;
  private eraserBrushHandlers: {
    down: (opt: fabric.IEvent<MouseEvent | TouchEvent>) => void;
    move: (opt: fabric.IEvent<MouseEvent | TouchEvent>) => void;
    up: () => void;
    out: () => void;
  } | null = null;

  // Touch gesture state
  private lastPinchDistance = 0;

  // Cumulative rotation angle (always rotate from original to avoid progressive shrinking)
  private cumulativeRotation = 0;

  // Base-image geometry captured at cumulativeRotation === 0. Annotation
  // positions are always rotated from this fixed baseline by the FULL
  // cumulative angle (never the per-step delta) so repeated rotations
  // don't accumulate floating-point drift.
  private rotationImageBaseline: { cx: number; cy: number; scale: number } | null = null;

  // Cached decoded copy of the processed original image. Built once on
  // `loadImage` so repeated rotations don't have to re-run
  // `processImage` (HEIC/EXIF) and re-decode the bytes on every step —
  // a major win for 10–15 MB photos.
  private processedSourceImage: HTMLImageElement | null = null;

  // Loader overlay shown during long-running operations like rotating
  // a huge image. Mounted/removed on the wrapperEl.
  private loaderEl: HTMLDivElement | null = null;

  // Runtime opacity for the pen brush. Applied by re-emitting the
  // current color as rgba() through DrawModule.setBrushColor whenever
  // opacity or color changes.
  private brushOpacity = 1;
  private currentBrushColor: string;

  // Attached keyboard-shortcut handler, so we can remove it on destroy.
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Dedicated host for Fabric's hidden text input. This keeps text
  // editing inside the editor/fullscreen subtree without affecting
  // wrapper layout (which would trigger resize-driven image repositioning).
  private textInputHostEl: HTMLDivElement | null = null;

  // Translucent "ghost" copy of the base image mounted behind the
  // Fabric canvas while in move mode. Because the Fabric canvas is
  // sized exactly to the visible image, panning in move mode would
  // otherwise clip the image at the canvas edge with no hint of what
  // will be cropped away on Apply. This ghost extends beyond the
  // canvas edges at reduced opacity so the user can see the whole
  // photo, mirroring the dimmed backdrop the crop tool uses.
  private ghostImageEl: HTMLImageElement | null = null;

  // Currently applied color-filter preset + live adjust values.
  // We store the last-committed state so the props panel can reflect
  // it, and to rebuild the Fabric filter stack whenever either
  // changes. Applying a filter or adjust is non-destructive — the raw
  // pixels stay on the base image; Fabric composites through its
  // WebGL/2D filter pipeline.
  private activeFilterPreset: ImageFilterPreset = 'none';
  private adjustments: ImageAdjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
  };
  private adjustDebounce: number | null = null;

  /** Axis-aligned bounds of the visible base image in canvas coordinates. */
  private getImageAnnotationBounds(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null {
    if (!this.baseImage) return null;
    const scaleX = (this.baseImage as any).scaleX || 1;
    const scaleY = (this.baseImage as any).scaleY || 1;
    const left = (this.baseImage as any).left || 0;
    const top = (this.baseImage as any).top || 0;
    const width = (this.baseImage.width || 0) * scaleX;
    const height = (this.baseImage.height || 0) * scaleY;
    if (width <= 0 || height <= 0) return null;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
    };
  }

  /** Build an absolute clip-rect matching the base image bounds. */
  private buildImageClipRect(): fabric.Rect | null {
    const b = this.getImageAnnotationBounds();
    if (!b) return null;
    return new fabric.Rect({
      left: b.left,
      top: b.top,
      width: b.right - b.left,
      height: b.bottom - b.top,
      absolutePositioned: true,
      originX: 'left',
      originY: 'top',
    });
  }

  /** Return true when object bbox intersects the base image bounds. */
  private intersectsImageBounds(obj: fabric.Object): boolean {
    const b = this.getImageAnnotationBounds();
    if (!b) return true;
    const r = obj.getBoundingRect(true, true);
    return !(
      r.left + r.width < b.left ||
      r.left > b.right ||
      r.top + r.height < b.top ||
      r.top > b.bottom
    );
  }

  /** Keep an annotation's bbox inside the image by translating it. */
  private constrainAnnotationToImageBounds(obj: fabric.Object | null): void {
    if (!obj || !this.baseImage) return;
    const anyObj = obj as any;
    if (anyObj._rpBaseImage) return;
    if (anyObj._rpType === 'callout-border' || anyObj._rpType === 'callout-tail') return;

    const b = this.getImageAnnotationBounds();
    if (!b) return;

    const r = obj.getBoundingRect(true, true);
    let dx = 0;
    let dy = 0;
    if (r.left < b.left) dx = b.left - r.left;
    if (r.left + r.width > b.right) dx = Math.min(dx, b.right - (r.left + r.width));
    if (r.top < b.top) dy = b.top - r.top;
    if (r.top + r.height > b.bottom) dy = Math.min(dy, b.bottom - (r.top + r.height));

    if (dx !== 0 || dy !== 0) {
      if (obj.type === 'rpArrow') {
        this.translateArrowAnnotation(anyObj, dx, dy);
        return;
      }
      if (obj.type === 'rpPolyline') {
        this.translatePolylineAnnotation(anyObj, dx, dy);
        return;
      }
      obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
      obj.setCoords();
    }
  }

  /** Shift a custom arrow object while preserving its endpoint geometry. */
  private translateArrowAnnotation(arrow: any, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    arrow.x1 += dx;
    arrow.x2 += dx;
    arrow.y1 += dy;
    arrow.y2 += dy;
    arrow._updateBBox?.();
  }

  /** Shift a custom polyline while preserving every vertex position. */
  private translatePolylineAnnotation(poly: any, dx: number, dy: number): void {
    if ((dx === 0 && dy === 0) || !Array.isArray(poly.points)) return;
    for (const point of poly.points) {
      point.x += dx;
      point.y += dy;
    }
    poly._updateBBox?.();
  }

  /**
   * While an annotation is being scaled via its corner/side handles, cap the
   * scale so its bounding box can never grow past the base-image footprint.
   * The handle opposite the one being dragged stays fixed (Fabric anchors the
   * transform origin there), and we shrink scaleX/scaleY just enough to keep
   * the moving edges on the image border. This prevents shapes from spilling
   * outside the image regardless of the current zoom level.
   */
  private constrainScalingToImageBounds(e: any): void {
    const obj = e?.target as fabric.Object | null;
    if (!obj) return;
    const anyObj = obj as any;
    if (anyObj._rpBaseImage) return;
    if (anyObj._rpType === 'callout-border' || anyObj._rpType === 'callout-tail') return;
    // Arrows / polylines are reshaped through their own endpoint controls,
    // which clamp each point directly — they don't use box scaling.
    if (obj.type === 'rpArrow' || obj.type === 'rpPolyline') return;

    const b = this.getImageAnnotationBounds();
    if (!b) return;

    const transform = e.transform || (this.fabricCanvas as any)?._currentTransform;
    const originX: string = transform?.originX || 'center';
    const originY: string = transform?.originY || 'center';

    const r = obj.getBoundingRect(true, true);

    // Anchor point = the fixed edge/corner during scaling (transform origin).
    const anchorX =
      originX === 'left' ? r.left : originX === 'right' ? r.left + r.width : r.left + r.width / 2;
    const anchorY =
      originY === 'top' ? r.top : originY === 'bottom' ? r.top + r.height : r.top + r.height / 2;

    // Maximum width/height allowed before the moving edge crosses the image.
    const maxWidth =
      originX === 'left'
        ? b.right - anchorX
        : originX === 'right'
          ? anchorX - b.left
          : 2 * Math.min(anchorX - b.left, b.right - anchorX);
    const maxHeight =
      originY === 'top'
        ? b.bottom - anchorY
        : originY === 'bottom'
          ? anchorY - b.top
          : 2 * Math.min(anchorY - b.top, b.bottom - anchorY);

    let fx = r.width > maxWidth && maxWidth > 0 ? maxWidth / r.width : 1;
    let fy = r.height > maxHeight && maxHeight > 0 ? maxHeight / r.height : 1;

    if (fx < 1 || fy < 1) {
      // Uniform-scaled shapes (circle/square) must keep aspect ratio.
      if (anyObj.lockUniScaling) {
        const f = Math.min(fx, fy);
        fx = f;
        fy = f;
      }
      obj.set({
        scaleX: (obj.scaleX || 1) * fx,
        scaleY: (obj.scaleY || 1) * fy,
      });
      obj.setCoords();
      // Re-anchor so the fixed corner stays put after shrinking the scale.
      const r2 = obj.getBoundingRect(true, true);
      const newAnchorX =
        originX === 'left'
          ? r2.left
          : originX === 'right'
            ? r2.left + r2.width
            : r2.left + r2.width / 2;
      const newAnchorY =
        originY === 'top'
          ? r2.top
          : originY === 'bottom'
            ? r2.top + r2.height
            : r2.top + r2.height / 2;
      obj.set({
        left: (obj.left || 0) + (anchorX - newAnchorX),
        top: (obj.top || 0) + (anchorY - newAnchorY),
      });
      obj.setCoords();
    }

    // Final safety net: nudge any residual overflow back inside.
    this.constrainAnnotationToImageBounds(obj);
  }

  constructor(container: HTMLElement, config?: Partial<RpEditorConfig>) {
    super();
    this.container = container;
    this.config = mergeConfig(config);
    this.currentBrushColor = this.config.defaultBrushColor;
    // Auto-inject the shell stylesheet so the IIFE bundle works with
    // no separate CSS import. No-op on subsequent instances / SSR.
    ensureShellStyles();

    // Resolve the i18n locale pack for `config.language` and back-fill
    // any labels the consumer didn't set explicitly. Per-key overrides
    // on `theme`, `strings`, `filterPresetLabels`, and
    // `calloutDefaults.text` always win — the pack only fills gaps.
    this.localePack = getLocalePack(this.config.language);
    this.applyLocalePack();

    // Additive lifecycle callbacks — mirror the internal event bus
    // onto config-level hooks so modal consumers (who never see the
    // editor instance) can subscribe. Inline consumers that already
    // call `editor.on(...)` are unaffected; these are just extra
    // subscribers on the same emitter.
    if (this.config.onImageLoaded) {
      this.on('image:loaded', (info) => {
        try {
          this.config.onImageLoaded?.(info);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[RpImageEditor] onImageLoaded threw:', e);
        }
      });
    }
    if (this.config.onError) {
      this.on('error', (err) => {
        try {
          this.config.onError?.(err as Error);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[RpImageEditor] onError threw:', e);
        }
      });
    }
    if (this.config.onModeChanged) {
      this.on('mode:changed', (mode) => {
        try {
          this.config.onModeChanged?.(mode);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[RpImageEditor] onModeChanged threw:', e);
        }
      });
    }
  }

  /**
   * Back-fill the merged config with strings from the resolved locale
   * pack. Any per-key value the consumer set explicitly wins \u2014 we
   * only assign when the current value is `undefined`. Called once
   * from the constructor after `mergeConfig`.
   */
  private applyLocalePack(): void {
    // Layer `config.labels` overrides on top of the resolved language
    // pack. `labels` is deep-partial so we merge each nested section
    // shallowly; unset keys fall through to the pack.
    const overrides = this.config.labels;
    if (overrides) {
      const base = this.localePack;
      this.localePack = {
        ...base,
        ...overrides,
        tool: { ...base.tool, ...(overrides.tool ?? {}) },
        shape: { ...base.shape, ...(overrides.shape ?? {}) },
        filter: { ...base.filter, ...(overrides.filter ?? {}) },
        props: {
          ...base.props,
          ...(overrides.props ?? {}),
          title: {
            ...base.props.title,
            ...(overrides.props?.title ?? {}),
          },
        },
      };
    }
    const pack = this.localePack;
    const theme = this.config.theme;

    // Header chrome
    if (theme.headerTitle === undefined) theme.headerTitle = pack.headerTitle;
    if (theme.headerSubtitle === undefined)
      theme.headerSubtitle = pack.headerSubtitle;
    if (theme.applyButtonText === undefined)
      theme.applyButtonText = pack.applyButton;
    if (theme.cancelButtonText === undefined)
      theme.cancelButtonText = pack.cancelButton;

    // Empty state
    const strings = this.config.strings ?? (this.config.strings = {});
    if (strings.emptyStateTitle === undefined)
      strings.emptyStateTitle = pack.emptyStateTitle;
    if (strings.emptyStateSubtitle === undefined)
      strings.emptyStateSubtitle = pack.emptyStateSubtitle;

    // Callout default label text \u2014 only fill when the consumer
    // didn't provide their own text. Other callout defaults (color,
    // fontSize, etc.) are not localizable.
    const cd = this.config.calloutDefaults;
    if (cd) {
      if (cd.text === undefined) cd.text = pack.calloutLabelText;
    } else {
      this.config.calloutDefaults = { text: pack.calloutLabelText };
    }

    // Filter preset labels \u2014 seed from the pack, then let any
    // consumer-provided labels take precedence per-key.
    this.config.filterPresetLabels = {
      none: pack.filter.none,
      grayscale: pack.filter.grayscale,
      sepia: pack.filter.sepia,
      vintage: pack.filter.vintage,
      cool: pack.filter.cool,
      warm: pack.filter.warm,
      invert: pack.filter.invert,
      ...(this.config.filterPresetLabels ?? {}),
    };
  }

  /**
   * Load an image into the editor
   */
  async loadImage(source: File | Blob | string): Promise<void> {
    try {
      // Store original blob for reset
      if (source instanceof Blob) {
        this.originalImageBlob = source;
      } else if (typeof source === 'string') {
        const resp = await fetch(source);
        this.originalImageBlob = await resp.blob();
      }

      // Process image (HEIC, EXIF, downscale)
      const { dataUrl, info } = await processImage(source, this.config.maxResolution);
      this.imageInfo = info;

      // Render shell BEFORE the canvas so the stage slot exists and
      // the canvas mounts inside the new layout. The shell is a no-op
      // when showToolbar is false.
      if (this.config.showToolbar && !this.toolbar) {
        this.renderToolbar();
      }

      // Initialize canvas
      this.initializeCanvas();

      // Load image into Fabric.js
      await this.loadImageOntoCanvas(dataUrl);

      // Fresh image — establish the rotation baseline at cum=0
      this.cumulativeRotation = 0;
      this.rotationImageBaseline = null;

      // Cache the decoded source image for fast rotations.
      this.processedSourceImage = await this.loadHtmlImage(dataUrl).catch(
        () => null,
      );

      // Initialize modules
      this.initializeModules();

      // Save initial state for undo
      this.historyModule?.initialize();

      // Emit loaded event
      this.emit('image:loaded', {
        width: info.processedWidth,
        height: info.processedHeight,
        downscaled: info.wasDownscaled,
      });
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Set the editor mode
   */
  setMode(mode: EditorMode): void {
    // Deactivate current mode
    this.deactivateCurrentMode();

    this.currentMode = mode;

    // Activate new mode
    switch (mode) {
      case 'move':
        this.activateMoveMode();
        break;
      case 'crop':
        this.activateCropMode();
        break;
      case 'draw':
        this.drawModule?.activate();
        this.applyToolCursor('pencil');
        break;
      case 'text':
        this.textModule?.activate();
        break;
      case 'eraser':
        this.eraserModule?.activate();
        this.applyToolCursor('eraser');
        this.enableBrushEraser();
        break;
      case 'callout':
        this.calloutModule?.activate();
        break;
      case 'shape-circle':
        this.shapeModule?.activate('circle');
        break;
      case 'shape-ellipse':
        this.shapeModule?.activate('ellipse');
        break;
      case 'shape-square':
        this.shapeModule?.activate('square');
        break;
      case 'shape-rectangle':
        this.shapeModule?.activate('rectangle');
        break;
      case 'shape-arrow':
        this.shapeModule?.activate('arrow');
        break;
      case 'shape-polyline':
        this.shapeModule?.activate('polyline');
        break;
      case 'filters':
      case 'adjust':
        // No fabric-side activation — the props panel drives filter
        // preset selection and live adjust sliders. We just want the
        // stage to feel like "move" (no drawing, no selection).
        this.activateMoveMode();
        break;
    }

    this.toolbar?.setActiveMode(mode);
    this.emit('mode:changed', mode);
  }

  /**
   * Zoom in
   */
  zoomIn(factor: number = 1.15): void {
    this.setZoom(this.zoomLevel * factor);
  }

  /**
   * Zoom out
   */
  zoomOut(factor: number = 1.15): void {
    this.setZoom(this.zoomLevel / factor);
  }

  /**
   * Set zoom level
   */
  setZoom(level: number): void {
    const clampedLevel = Math.max(
      RpImageEditor.MIN_ZOOM,
      Math.min(RpImageEditor.MAX_ZOOM, level),
    );
    this.zoomLevel = clampedLevel;

    if (this.fabricCanvas) {
      const center = this.fabricCanvas.getCenter();
      this.fabricCanvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        clampedLevel
      );
      this.clampViewportPan();
      this.fabricCanvas.renderAll();
    }

    this.toolbar?.updateZoomState(clampedLevel);
    this.updateGhostImagePosition();
    this.emit('zoom:changed', clampedLevel);
  }

  /**
   * Rotate left (−90°)
   */
  async rotateLeft(): Promise<void> {
    await this.rotate(-90);
  }

  /**
   * Rotate right (+90°)
   */
  async rotateRight(): Promise<void> {
    await this.rotate(90);
  }

  /**
   * Undo last action
   */
  async undo(): Promise<void> {
    await this.historyModule?.undo();
    this.refreshBaseImageRef();
    this.calloutModule?.rehydrateFromCanvas();
  }

  /**
   * Redo last undone action
   */
  async redo(): Promise<void> {
    await this.historyModule?.redo();
    this.refreshBaseImageRef();
    this.calloutModule?.rehydrateFromCanvas();
  }

  /**
   * Toggle browser fullscreen on the editor container. Silently
   * no-ops if the Fullscreen API is unavailable or the request is
   * denied by the browser (e.g. not user-initiated).
   */
  toggleFullscreen(): void {
    const el = this.container;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else if (typeof el.requestFullscreen === 'function') {
        el.requestFullscreen().catch(() => {
          /* user gesture / permission — ignore */
        });
      }
    } catch {
      /* Fullscreen API unavailable — ignore */
    }
  }

  /**
   * Reset to original image
   */
  async reset(): Promise<void> {
    if (!this.originalImageBlob || !this.fabricCanvas) return;

    // Re-process and reload original
    const { dataUrl } = await processImage(this.originalImageBlob, this.config.maxResolution);
    this.fabricCanvas.clear();
    await this.loadImageOntoCanvas(dataUrl);
    this.processedSourceImage = await this.loadHtmlImage(dataUrl).catch(
      () => null,
    );
    this.zoomLevel = 1;
    this.cumulativeRotation = 0;
    this.rotationImageBaseline = null;
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    // Clear any Filter/Adjust state so "Reset" truly returns the
    // original image.
    this.resetImageEffects(false);
    this.historyModule?.initialize();
    this.setMode('move');
  }

  /**
   * Delete the currently selected annotation (callout or other).
   * Returns true if something was deleted.
   */
  deleteSelectedAnnotation(): boolean {
    const deleted = this.calloutModule?.deleteSelected() ?? false;
    if (deleted) {
      this.historyModule?.saveState();
    }
    return deleted;
  }

  /**
   * Set brush/text color
   */
  setColor(color: string): void {
    this.currentBrushColor = color;
    const applied = this.brushOpacity < 1
      ? this.colorWithAlpha(color, this.brushOpacity)
      : color;
    this.drawModule?.setBrushColor(applied);
    this.textModule?.setTextColor(color);
    this.calloutModule?.setColor(color);
    this.shapeModule?.setStrokeColor(color);

    // Keep callout labels readable: whenever the callout background
    // changes we auto-flip the label fill to the contrasting color
    // (white text on dark boxes, black text on light boxes) — but only
    // for the callouts currently selected AND only when the user has
    // not manually locked a text color for that label. This solves the
    // "white text disappears on a white callout" issue without adding
    // a separate text-color picker to the panel.
    this.recolorSelectedCalloutLabels(color);
  }

  /**
   * Return #000000 or #ffffff — whichever contrasts better with `bg`.
   * Accepts hex (#rgb / #rrggbb) and rgb()/rgba() strings.
   */
  private contrastTextFor(bg: string): string {
    const rgb = this.parseColorToRgb(bg);
    if (!rgb) return '#000000';
    // Perceived luminance (Rec. 709)
    const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return lum > 0.55 ? '#000000' : '#ffffff';
  }

  private parseColorToRgb(input: string): { r: number; g: number; b: number } | null {
    if (!input) return null;
    const s = input.trim().toLowerCase();
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
      return null;
    }
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  /**
   * Walk the canvas and re-fill any callout-label belonging to a
   * currently-selected callout with a color that contrasts with `bg`.
   * Labels the user has explicitly recolored are marked
   * `_rpUserSetTextColor` and left alone.
   */
  private recolorSelectedCalloutLabels(bg: string): void {
    if (!this.fabricCanvas) return;
    const active = this.fabricCanvas.getActiveObject() as any;
    if (!active) return;

    const ids = new Set<number>();
    if (active.type === 'activeSelection') {
      (active as fabric.ActiveSelection).forEachObject((obj: any) => {
        if (obj.calloutId != null) ids.add(obj.calloutId);
      });
    } else if (active.calloutId != null) {
      ids.add(active.calloutId);
    }
    if (ids.size === 0) return;

    const readable = this.contrastTextFor(bg);
    this.fabricCanvas.getObjects().forEach((obj: any) => {
      if (
        obj._rpType === 'callout-label' &&
        ids.has(obj.calloutId) &&
        !obj._rpUserSetTextColor
      ) {
        obj.set({ fill: readable });
      }
    });
    this.fabricCanvas.requestRenderAll();
  }

  /**
   * Set brush width
   */
  setBrushWidth(width: number): void {
    this.drawModule?.setBrushWidth(width);
    this.shapeModule?.setStrokeWidth(width);
  }

  /**
   * Adjust the freehand brush opacity (0..1). Applied by re-emitting
   * the current brush color as rgba() to the DrawModule — module
   * internals are not modified.
   */
  setBrushOpacity(opacity: number): void {
    this.brushOpacity = Math.max(0, Math.min(1, opacity));
    if (this.currentBrushColor) {
      const applied = this.brushOpacity < 1
        ? this.colorWithAlpha(this.currentBrushColor, this.brushOpacity)
        : this.currentBrushColor;
      this.drawModule?.setBrushColor(applied);
    }
  }

  /**
   * Mirror the base image horizontally. Preserves rotation baseline
   * tracking by resetting cumulativeRotation only when needed.
   */
  flipHorizontal(): void {
    if (!this.baseImage || !this.fabricCanvas) return;
    (this.baseImage as any).set(
      'flipX',
      !((this.baseImage as any).flipX || false),
    );
    this.fabricCanvas.requestRenderAll();
    this.refreshGhostImage();
    this.historyModule?.saveState();
  }

  /**
   * Mirror the base image vertically.
   */
  flipVertical(): void {
    if (!this.baseImage || !this.fabricCanvas) return;
    (this.baseImage as any).set(
      'flipY',
      !((this.baseImage as any).flipY || false),
    );
    this.fabricCanvas.requestRenderAll();
    this.refreshGhostImage();
    this.historyModule?.saveState();
  }

  /* -----------------------------------------------------------------
   * Filters + Adjust (non-destructive, composited through Fabric)
   * ----------------------------------------------------------------- */

  /**
   * Apply a one-click color filter preset. Passing `'none'` clears the
   * preset while leaving Adjust sliders intact.
   */
  applyFilterPreset(preset: ImageFilterPreset): void {
    this.activeFilterPreset = preset;
    this.rebuildImageFilters(true);
  }

  /**
   * Update a single Adjust knob. Values are clamped to sane ranges:
   * brightness/contrast/saturation ∈ [-1, 1], blur ∈ [0, 1].
   * Rebuilds the filter stack with a small debounce so dragging is
   * cheap on large photos.
   */
  setAdjustment<K extends keyof ImageAdjustments>(
    key: K,
    value: ImageAdjustments[K],
  ): void {
    const clamped =
      key === 'blur'
        ? Math.max(0, Math.min(1, value as number))
        : Math.max(-1, Math.min(1, value as number));
    this.adjustments = { ...this.adjustments, [key]: clamped };
    if (this.adjustDebounce !== null) {
      window.clearTimeout(this.adjustDebounce);
    }
    this.adjustDebounce = window.setTimeout(() => {
      this.adjustDebounce = null;
      this.rebuildImageFilters(false);
    }, 40);
  }

  /** Snapshot of the current filter + adjust state. */
  getImageEffects(): { preset: ImageFilterPreset; adjustments: ImageAdjustments } {
    return {
      preset: this.activeFilterPreset,
      adjustments: { ...this.adjustments },
    };
  }

  /** Clear filter + all adjust knobs. */
  resetImageEffects(save: boolean = true): void {
    this.activeFilterPreset = 'none';
    this.adjustments = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };
    this.rebuildImageFilters(save);
  }

  /**
   * Rebuild `baseImage.filters` from `activeFilterPreset` + `adjustments`
   * and re-apply. Ghost preview is refreshed so the letterboxed edges
   * stay in sync with the composited pixels.
   */
  private rebuildImageFilters(saveHistory: boolean): void {
    if (!this.baseImage || !this.fabricCanvas) return;
    const F = (fabric as any).Image?.filters;
    if (!F) return;

    // Fabric's default WebGL filter backend caps textures at
    // `fabric.textureSize` (2048 in Fabric 5). Any image larger than
    // that gets silently cropped to the top-left corner after
    // applyFilters(). Two-pronged fix:
    //   1. Bump textureSize to the WebGL max supported by the GPU so
    //      medium photos keep the GPU fast path.
    //   2. Fall back to the 2D backend when the image exceeds the
    //      texture cap — slower but preserves the full frame.
    this.ensureFilterBackendCanHandle(this.baseImage);

    const stack: any[] = [];

    // Preset first so Adjust sliders modulate on top of it.
    switch (this.activeFilterPreset) {
      case 'grayscale':
        stack.push(new F.Grayscale());
        break;
      case 'sepia':
        stack.push(new F.Sepia());
        break;
      case 'invert':
        stack.push(new F.Invert());
        break;
      case 'vintage':
        // Fabric ships a `Vintage` filter; fall back to sepia + slight
        // brightness/contrast tweak if the build strips it.
        if (F.Vintage) stack.push(new F.Vintage());
        else {
          stack.push(new F.Sepia());
          stack.push(new F.Contrast({ contrast: 0.08 }));
        }
        break;
      case 'cool':
        // Push blue channel up, red down.
        stack.push(
          new F.ColorMatrix({
            matrix: [
              0.9, 0, 0, 0, 0,
              0, 1.0, 0, 0, 0,
              0, 0, 1.15, 0, 0,
              0, 0, 0, 1, 0,
            ],
          }),
        );
        break;
      case 'warm':
        stack.push(
          new F.ColorMatrix({
            matrix: [
              1.15, 0, 0, 0, 0,
              0, 1.02, 0, 0, 0,
              0, 0, 0.9, 0, 0,
              0, 0, 0, 1, 0,
            ],
          }),
        );
        break;
      case 'none':
      default:
        break;
    }

    // Adjust knobs.
    if (this.adjustments.brightness !== 0) {
      stack.push(new F.Brightness({ brightness: this.adjustments.brightness }));
    }
    if (this.adjustments.contrast !== 0) {
      stack.push(new F.Contrast({ contrast: this.adjustments.contrast }));
    }
    if (this.adjustments.saturation !== 0) {
      stack.push(new F.Saturation({ saturation: this.adjustments.saturation }));
    }
    if (this.adjustments.blur > 0) {
      // Fabric's Blur is ~0..1 where 0.1 is already a strong blur.
      stack.push(new F.Blur({ blur: this.adjustments.blur * 0.5 }));
    }

    (this.baseImage as any).filters = stack;
    try {
      (this.baseImage as any).applyFilters();
    } catch (e) {
      // WebGL context lost or filter build error — silently swallow so
      // the editor stays usable; the raw image remains visible.
    }
    this.fabricCanvas.requestRenderAll();
    this.refreshGhostImage();
    if (saveHistory) this.historyModule?.saveState();
  }

  /**
   * Ensure the current filter backend can render `img` at full size.
   * The WebGL backend caps at `fabric.textureSize`; anything larger
   * comes back cropped to the top-left. We first bump textureSize to
   * what the GPU actually supports, then fall back to the 2D backend
   * if the image is still bigger than that ceiling.
   */
  private ensureFilterBackendCanHandle(img: fabric.Image): void {
    const F = fabric as any;
    const rawW = (img as any)._element?.naturalWidth ||
      (img as any)._element?.width ||
      img.width ||
      0;
    const rawH = (img as any)._element?.naturalHeight ||
      (img as any)._element?.height ||
      img.height ||
      0;
    const needed = Math.max(rawW, rawH);

    // Query the actual WebGL max texture size once and cache it.
    if (!F._rpMaxTexSize) {
      try {
        const probe = document.createElement('canvas');
        const gl =
          (probe.getContext('webgl2') as WebGLRenderingContext | null) ||
          (probe.getContext('webgl') as WebGLRenderingContext | null) ||
          (probe.getContext('experimental-webgl') as WebGLRenderingContext | null);
        F._rpMaxTexSize = gl
          ? gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096
          : 4096;
      } catch {
        F._rpMaxTexSize = 4096;
      }
    }
    const maxTex: number = F._rpMaxTexSize;

    // Bump Fabric's textureSize up to the GPU cap so medium/large
    // photos keep using the fast WebGL path.
    if ((F.textureSize || 2048) < maxTex) {
      F.textureSize = maxTex;
    }

    // If the image is still bigger than the GPU cap, switch to the
    // Canvas2d filter backend (no size limit, slower).
    if (needed > maxTex && F.Canvas2dFilterBackend) {
      const current = F.filterBackend;
      const alreadyCanvas2d =
        current && current.constructor && current.constructor.name === 'Canvas2dFilterBackend';
      if (!alreadyCanvas2d) {
        F.filterBackend = new F.Canvas2dFilterBackend();
      }
    }
  }

  /**
   * Get the edited result
   */
  async getResult(): Promise<RpEditorResult> {
    if (!this.fabricCanvas) {
      throw new Error('Editor not initialized');
    }

    // Deactivate current mode to clean up overlays
    this.deactivateCurrentMode();

    // Hide callout borders/anchors before export
    this.calloutModule?.hideAllControls();
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.renderAll();

    const format = this.config.exportFormat;
    const quality = this.config.exportQuality;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const userMultiplier = this.config.exportPixelRatio;

    // Native-resolution multiplier: the editor scales the image down to
    // fit the wrapper for display purposes, but for export we want to
    // render back up at the image's intrinsic resolution so annotations
    // and crops stay sharp. nativeMultiplier = 1 / displayScale.
    let nativeMultiplier = 1;
    if (this.config.exportAtNativeResolution && this.baseImage) {
      const scaleX = (this.baseImage as any).scaleX || 1;
      // scaleX/scaleY are uniform (set together in loadImageOntoCanvas)
      if (scaleX > 0) {
        nativeMultiplier = 1 / scaleX;
      }
    }
    const multiplier = userMultiplier * nativeMultiplier;

    // Save current viewport state so we can restore after export
    const currentVPT = this.fabricCanvas.viewportTransform?.slice();
    const currentZoom = this.fabricCanvas.getZoom();
    const currentBgColor = this.fabricCanvas.backgroundColor;

    // Determine the image region bounds from the base image
    let imgLeft = 0;
    let imgTop = 0;
    let imgDisplayW = this.fabricCanvas.getWidth();
    let imgDisplayH = this.fabricCanvas.getHeight();

    if (this.baseImage) {
      const scaleX = (this.baseImage as any).scaleX || 1;
      const scaleY = (this.baseImage as any).scaleY || 1;
      imgLeft = (this.baseImage as any).left || 0;
      imgTop = (this.baseImage as any).top || 0;
      imgDisplayW = (this.baseImage.width || imgDisplayW) * scaleX;
      imgDisplayH = (this.baseImage.height || imgDisplayH) * scaleY;
    }

    // Calculate the visible region based on current zoom/pan viewport
    const canvasW = this.fabricCanvas.getWidth();
    const canvasH = this.fabricCanvas.getHeight();
    const vpt = currentVPT || [1, 0, 0, 1, 0, 0];
    const zoom = currentZoom || 1;

    // Map screen corners to image-space using inverse viewport transform
    const invVpt = fabric.util.invertTransform(vpt as any);
    const tl = fabric.util.transformPoint(new fabric.Point(0, 0), invVpt as any);
    const br = fabric.util.transformPoint(new fabric.Point(canvasW, canvasH), invVpt as any);

    // Clamp visible region to image bounds
    const visLeft = Math.max(tl.x, imgLeft);
    const visTop = Math.max(tl.y, imgTop);
    const visRight = Math.min(br.x, imgLeft + imgDisplayW);
    const visBottom = Math.min(br.y, imgTop + imgDisplayH);
    const visWidth = Math.max(0, visRight - visLeft);
    const visHeight = Math.max(0, visBottom - visTop);

    // If zoom is 1× and no pan, export the full image region (backwards-compatible).
    // Also fall back to the full image bounds if the user has panned/zoomed the
    // image completely outside the visible canvas — otherwise the intersection is
    // empty and we would produce a 0×0 offscreen canvas → 0-byte File on Apply.
    const isDefaultView = zoom === 1 && vpt[4] === 0 && vpt[5] === 0;
    const hasVisibleIntersection = visWidth > 0 && visHeight > 0;
    const useFullImageBounds = isDefaultView || !hasVisibleIntersection;
    const exportLeft = useFullImageBounds ? imgLeft : visLeft;
    const exportTop = useFullImageBounds ? imgTop : visTop;
    const exportW = useFullImageBounds ? imgDisplayW : visWidth;
    const exportH = useFullImageBounds ? imgDisplayH : visHeight;

    // Reset viewport for clean rendering — we handle the offset manually
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.fabricCanvas.setZoom(1);

    // Use an offscreen canvas to render ONLY the visible image region.
    // Guard against sub-pixel dimensions (e.g. extreme zoom-out or degenerate
    // state) — a 0×0 canvas would produce a 0-byte blob.
    const offW = Math.max(1, Math.round(exportW * multiplier));
    const offH = Math.max(1, Math.round(exportH * multiplier));
    const offscreen = document.createElement('canvas');
    offscreen.width = offW;
    offscreen.height = offH;
    const offCtx = offscreen.getContext('2d')!;

    // Fill background: white for JPEG (no transparency), transparent for PNG
    if (format === 'jpeg') {
      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, offW, offH);
    }

    // Temporarily hide canvas background so it doesn't get baked in
    this.fabricCanvas.backgroundColor = 'transparent';
    this.fabricCanvas.renderAll();

    // Render the Fabric canvas onto the offscreen canvas, offset so only
    // the visible image region is captured.
    offCtx.save();
    offCtx.scale(multiplier, multiplier);
    offCtx.translate(-exportLeft, -exportTop);
    (this.fabricCanvas as any).renderCanvas(
      offCtx,
      this.fabricCanvas.getObjects(),
    );
    offCtx.restore();

    // Get the base64 from the clean offscreen canvas
    const base64 = offscreen.toDataURL(mimeType, quality);

    // Clean up offscreen canvas
    offscreen.width = 1;
    offscreen.height = 1;

    // Convert base64 to blob
    const blob = await this.base64ToBlob(base64, mimeType);

    // Create File object
    const fileName = `edited_image_${Date.now()}.${format}`;
    const file = new File([blob], fileName, { type: mimeType });

    // Restore background color and viewport
    this.fabricCanvas.backgroundColor = currentBgColor;
    if (currentVPT) {
      this.fabricCanvas.setViewportTransform(currentVPT);
    }
    this.fabricCanvas.setZoom(currentZoom);

    // Restore callout controls (only for selected callouts)
    this.calloutModule?.showAllControls();
    this.fabricCanvas.renderAll();

    const result: RpEditorResult = {
      base64,
      blob,
      file,
      width: offW,
      height: offH,
      format,
    };

    this.emit('image:exported', result);
    return result;
  }

  /**
   * Destroy the editor and clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.deactivateCurrentMode();
    this.hideLoader();
    this.hideGhostImage();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    this.toolbar?.destroy();
    this.fabricCanvas?.dispose();
    this.removeAllListeners();

    if (this.wrapperEl) {
      this.wrapperEl.innerHTML = '';
      this.wrapperEl.remove();
    }
    if (this.textInputHostEl) {
      this.textInputHostEl.remove();
      this.textInputHostEl = null;
    }

    this.fabricCanvas = null;
    this.baseImage = null;
    this.originalImageBlob = null;
    this.processedSourceImage = null;
    this.rotationImageBaseline = null;
    this.cropModule = null;
    this.drawModule = null;
    this.textModule = null;
    this.eraserModule = null;
    this.calloutModule = null;
    this.shapeModule = null;
    this.historyModule = null;
    this.toolbar = null;
  }

  /**
   * Get current mode
   */
  getMode(): EditorMode {
    return this.currentMode;
  }

  /**
   * Get current zoom level
   */
  getZoomLevel(): number {
    return this.zoomLevel;
  }

  // ───────────────────────── Private ─────────────────────────

  private initializeCanvas(): void {
    // Create wrapper — this fills the available space and provides the background
    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = 'rp-editor-canvas-wrapper';
    this.wrapperEl.style.cssText = `
      width: 100%;
      height: 100%;
      flex: 1;
      align-self: stretch;
      position: relative;
      overflow: hidden;
      background: transparent;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create canvas element — will be sized to the image after loading
    this.canvasEl = document.createElement('canvas');
    this.canvasEl.id = `rp-canvas-${Date.now()}`;
    this.wrapperEl.appendChild(this.canvasEl);

    // Mount into the shell stage slot when the toolbar/shell exists,
    // otherwise fall back to the container root (headless / showToolbar=false).
    const stageSlot = this.toolbar?.getStageSlot();
    if (stageSlot) {
      this.toolbar!.attachCanvasWrapper(this.wrapperEl);
    } else {
      this.container.insertBefore(this.wrapperEl, this.container.firstChild);
    }

    if (!this.textInputHostEl) {
      this.textInputHostEl = document.createElement('div');
      this.textInputHostEl.className = 'rp-editor-text-input-host';
      this.textInputHostEl.style.cssText = [
        'position: absolute',
        'left: -9999px',
        'top: 0',
        'width: 1px',
        'height: 1px',
        'overflow: hidden',
        'opacity: 0',
        'pointer-events: none',
      ].join(';');
      this.container.appendChild(this.textInputHostEl);
    }

    // Start with a reasonable default; will be resized to image in loadImageOntoCanvas
    const rect = this.wrapperEl.getBoundingClientRect();
    const canvasW = Math.floor(rect.width) || 800;
    const canvasH = Math.floor(rect.height) || 500;

    // Initialize Fabric.js canvas
    this.fabricCanvas = new fabric.Canvas(this.canvasEl, {
      width: canvasW,
      height: canvasH,
      backgroundColor: 'transparent',
      selection: false,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      allowTouchScrolling: false,
    });

    // Setup touch/mouse event handlers
    this.setupGestureHandlers();

    // Handle resize
    this.setupResizeObserver();
  }

  private async loadImageOntoCanvas(dataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(dataUrl, (img: fabric.Image) => {
        if (!img) {
          reject(new Error('Failed to load image onto canvas'));
          return;
        }
        try {
          this.installBaseImage(img);
          resolve();
        } catch (err) {
          reject(err as Error);
        }
      }, { crossOrigin: 'anonymous' });
    });
  }

  /**
   * Fast path used by `rotate()`: skip the PNG `toDataURL` + re-decode
   * roundtrip by handing an already-rendered HTML element (image or
   * canvas) straight to Fabric. On 10–15 MB photos this cuts ~hundreds
   * of ms per rotation vs. going through a data URL.
   */
  private loadImageElementOntoCanvas(
    element: HTMLImageElement | HTMLCanvasElement,
  ): void {
    const img = new fabric.Image(element as any, { crossOrigin: 'anonymous' });
    this.installBaseImage(img);
  }

  /**
   * Shared mount logic: size the canvas to the wrapper, place the image
   * at the origin with an explicit uniform scale, and replace any prior
   * base image while leaving annotations intact.
   */
  private installBaseImage(img: fabric.Image): void {
    if (!this.fabricCanvas || !this.wrapperEl) {
      throw new Error('Editor canvas not initialized');
    }

    // Mark as base image (not an annotation)
    (img as any)._rpBaseImage = true;
    img.selectable = false;
    img.evented = false;

    // Calculate the available space in the wrapper
    const wrapperRect = this.wrapperEl.getBoundingClientRect();
    const availW = Math.floor(wrapperRect.width) || 800;
    const availH = Math.floor(wrapperRect.height) || 500;
    const imgW = img.width || availW;
    const imgH = img.height || availH;

    // Scale image to FIT the available area (uniform scale). We allow
    // scale > 1 so small images fill the stage instead of looking like
    // a postage stamp centered in a giant canvas. Native-resolution
    // export is preserved because getResult() applies nativeMultiplier
    // = 1 / scaleX to render back at the image's intrinsic pixels.
    const scale = Math.min(availW / imgW, availH / imgH);
    const displayW = Math.round(imgW * scale);
    const displayH = Math.round(imgH * scale);

    // Resize the Fabric canvas to fill the entire wrapper. The image is
    // then centered inside; the "letterbox" on all four sides gives the
    // ghost preview room to show what lies beyond the visible image
    // when the user pans/zooms — evenly in every direction.
    const canvasW = availW;
    const canvasH = availH;
    this.fabricCanvas.setWidth(canvasW);
    this.fabricCanvas.setHeight(canvasH);

    // Center the image inside the canvas with explicit scaleX/scaleY.
    const imgLeft = Math.round((canvasW - displayW) / 2);
    const imgTop = Math.round((canvasH - displayH) / 2);
    img.set({
      left: imgLeft,
      top: imgTop,
      originX: 'left',
      originY: 'top',
      scaleX: displayW / imgW,
      scaleY: displayH / imgH,
    });

    // Remove old base image if exists
    const oldBase = this.fabricCanvas.getObjects().find(
      (o: any) => o._rpBaseImage,
    );
    if (oldBase) {
      this.fabricCanvas.remove(oldBase);
    }

    this.baseImage = img;
    this.fabricCanvas.add(img);
    img.sendToBack();

    // Re-apply the current filter + adjust stack to the new base image
    // so effects persist across crop/rotate/reload operations. Silent
    // no-op when nothing is active.
    if (
      this.activeFilterPreset !== 'none' ||
      this.adjustments.brightness !== 0 ||
      this.adjustments.contrast !== 0 ||
      this.adjustments.saturation !== 0 ||
      this.adjustments.blur !== 0
    ) {
      this.rebuildImageFilters(false);
    }

    this.fabricCanvas.renderAll();

    // Keep the translucent ghost preview mounted whenever we have a
    // base image, so the user can always see what lies beyond the
    // visible canvas after zooming/panning — regardless of the active
    // tool. Crop mode explicitly hides it via activateCropMode().
    if (this.currentMode !== 'crop') {
      this.showGhostImage();
    }
  }

  private initializeModules(): void {
    if (!this.fabricCanvas) return;

    this.cropModule = new CropModule(this.fabricCanvas);
    this.drawModule = new DrawModule(this.fabricCanvas);
    this.textModule = new TextModule(this.fabricCanvas);
    this.eraserModule = new EraserModule(this.fabricCanvas);
    this.calloutModule = new CalloutModule(this.fabricCanvas);
    this.shapeModule = new ShapeModule(this.fabricCanvas);
      const boundsProvider = () => this.getImageAnnotationBounds();
      this.textModule?.setPlacementBoundsProvider(boundsProvider);
      this.calloutModule?.setPlacementBoundsProvider(boundsProvider);
      this.shapeModule?.setPlacementBoundsProvider(boundsProvider);

    this.historyModule = new HistoryModule(this.fabricCanvas, this.config.maxUndoSteps);

    // Set defaults from config

    this.drawModule?.setBrushColor(this.config.defaultBrushColor);
    this.drawModule?.setBrushWidth(this.config.defaultBrushWidth);
    this.textModule?.setTextColor(this.config.defaultTextColor);
    this.textModule?.setFontSize(this.config.defaultTextFontSize);
    this.calloutModule?.setColor(this.config.defaultBrushColor);
    // Additive: apply consumer-provided callout defaults (color +
    // text + limits) if supplied. Falls through to the built-in
    // defaults when the field is omitted.
    const cd = this.config.calloutDefaults;
    if (cd) {
      if (cd.color) this.calloutModule?.setColor(cd.color);
      if (cd.textColor) this.calloutModule?.setTextColor(cd.textColor);
      if (typeof cd.fontSize === 'number' && cd.fontSize > 0) {
        this.calloutModule?.setFontSize(cd.fontSize);
      }
      this.calloutModule?.setDefaults({
        text: cd.text,
        maxChars: cd.maxChars,
        lineBreakAt: cd.lineBreakAt,
      });
    }
    this.shapeModule?.setStrokeColor(
      this.config.defaultShapeColor ?? this.config.defaultBrushColor,
    );
    this.shapeModule?.setStrokeWidth(
      this.config.defaultShapeStrokeWidth ?? this.config.defaultBrushWidth,
    );

    // Listen for drawing completion to save undo state
    this.fabricCanvas.on('path:created', () => {
      // Mark drawn paths as annotations
      const objects = this.fabricCanvas!.getObjects();
      objects.forEach((obj: any) => {
        if (obj.type === 'path' && !obj._rpBaseImage && !obj._rpAnnotation) {
          obj._rpAnnotation = true;
          obj._rpType = 'draw';
          // Clip freehand strokes to the image footprint so marks made in
          // the letterbox/padding area never appear in-edit or in export.
          obj.clipPath = this.buildImageClipRect();
          if (!this.intersectsImageBounds(obj)) {
            this.fabricCanvas?.remove(obj);
            return;
          }
        }
        if (obj.type === 'path' && obj._rpType === 'draw') {
          this.lockDrawPath(obj);
        }
      });
      this.historyModule?.saveState();
    });

    // Listen for text editing completion
    this.fabricCanvas.on('text:editing:entered', (e: any) => {
      const tgt = e?.target as any;
      if (!tgt || tgt.type !== 'i-text') return;

      const host = this.textInputHostEl || this.container;
      if (host) {
        tgt.hiddenTextareaContainer = host;
      }

      const textarea = tgt.hiddenTextarea as HTMLTextAreaElement | undefined;
      if (textarea) {
        // Defensively force the hidden textarea out of layout flow so
        // typing cannot perturb stage sizing or trigger "dancing".
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        setTimeout(() => textarea.focus(), 0);
      }
    });

    this.fabricCanvas.on('text:editing:exited', () => {
      this.historyModule?.saveState();
    });

    // Listen for object modifications
    this.fabricCanvas.on('object:modified', (e: any) => {
      this.constrainAnnotationToImageBounds(e?.target || null);
      this.historyModule?.saveState();
    });

    // Keep dragged/scaled annotations from leaving the image area.
    this.fabricCanvas.on('object:moving', (e: any) => {
      this.constrainAnnotationToImageBounds(e?.target || null);
    });
    this.fabricCanvas.on('object:scaling', (e: any) => {
      this.constrainScalingToImageBounds(e);
    });

    // Listen for object removal (eraser)
    this.fabricCanvas.on('object:removed', (e: any) => {
      // Callouts are multi-part annotations. Their history is saved as a
      // single logical operation elsewhere; skip per-part removals here.
      if (e.target?._rpAnnotation && e.target?.calloutId == null) {
        this.historyModule?.saveState();
      }
    });

    // Listen for callout / annotation additions
    this.fabricCanvas.on('object:added', (e: any) => {
      const tgt = e.target;
      if (!tgt) return;

      // Ensure all i-text objects (including undo/redo rehydration) are
      // configured to create their hidden textarea in our isolated host.
      if (tgt.type === 'i-text') {
        const host = this.textInputHostEl || this.container;
        if (host) {
          tgt.hiddenTextareaContainer = host;
        }
      }

      // Keep draw paths non-interactive after undo/redo rehydration.
      if (tgt.type === 'path' && tgt._rpType === 'draw') {
        tgt.clipPath = this.buildImageClipRect();
        this.lockDrawPath(tgt);
      }

      // When a new callout label is added, force its fill to a color
      // that contrasts with the callout's current background so the
      // text stays readable on light backgrounds (e.g. white). We only
      // do this at creation time; once the user manually changes the
      // text color we honor their choice via `_rpUserSetTextColor`.
      if (tgt._rpShapeType) {
        this.constrainAnnotationToImageBounds(tgt);
      }

      if (tgt._rpType === 'callout-label' && !tgt._rpUserSetTextColor) {
        const bgObj = this.fabricCanvas!
          .getObjects()
          .find(
            (o: any) =>
              o._rpType === 'callout-box' && o.calloutId === tgt.calloutId,
          ) as any;
        const bg =
          (bgObj && bgObj.fill) || this.currentBrushColor || '#ffffff';
        const readable = this.contrastTextFor(bg);
        tgt.set({ fill: readable });
        this.fabricCanvas!.requestRenderAll();
      }

      // Do not save history per callout part (tail/box/label/etc.).
      // A single save is emitted once the full callout is created.
    });

    this.fabricCanvas.on('rp:callout:created', () => {
      this.historyModule?.saveState();
    });

    // Setup history change notifications
    this.historyModule.onChange((state) => {
      this.toolbar?.updateHistoryState(state.canUndo, state.canRedo);
      this.emit('history:changed', state);
    });
  }

  private renderToolbar(): void {
    if (!this.config.showToolbar) return;

    // The Shell manages the entire container structure (top bar, rails,
    // stage slot, bottom bar, properties panel). The canvas wrapper is
    // mounted into the stage slot inside initializeCanvas().
    const callbacks: ToolbarCallbacks = {
      onModeChange: (mode) => this.setMode(mode),
      onZoomIn: () => this.zoomIn(),
      onZoomOut: () => this.zoomOut(),
      onRotateLeft: () => this.rotateLeft(),
      onRotateRight: () => this.rotateRight(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onReset: () => this.reset(),
      onColorChange: (color) => this.setColor(color),
      onBrushWidthChange: (width) => this.setBrushWidth(width),
      onCropRatioChange: (ratio) => {
        this.cropModule?.setAspectRatio(ratio);
      },
      onApplyCrop: () => this.applyCrop(),
      onCancelCrop: () => {
        this.cropModule?.deactivate();
        this.setMode('move');
      },
      onDeleteAnnotation: () => this.deleteSelectedAnnotation(),
      onFlipHorizontal: () => this.flipHorizontal(),
      onFlipVertical: () => this.flipVertical(),
      onFitZoom: () => this.setZoom(1),
      onZoomTo: (level) => this.setZoom(level),
      onOpacityChange: (opacity) => this.setBrushOpacity(opacity),
      onTextSize: (size) => this.textModule?.setFontSize(size),
      onEraserSize: (size) => this.eraserModule?.setEraserWidth(size),
      onFilterPreset: (preset) => this.applyFilterPreset(preset),
      onAdjustChange: (key, value) => this.setAdjustment(key, value),
      onResetEffects: () => this.resetImageEffects(true),
      getImageEffects: () => this.getImageEffects(),
      onApply: this.config.onApply,
      onClose: this.config.onClose,
      onToggleFullscreen: () => this.toggleFullscreen(),
    };

    this.toolbar = new Toolbar(
      this.container,
      this.config.theme,
      this.config.colorPalette,
      this.config.cropAspectRatios,
      callbacks,
      this.config.disabledFeatures,
      {
        filterPresets: this.config.filterPresets,
        filterPresetLabels: this.config.filterPresetLabels,
        emptyStateTitle: this.config.strings?.emptyStateTitle,
        emptyStateSubtitle: this.config.strings?.emptyStateSubtitle,
        labels: this.localePack,
        currentImageIndex: this.config.currentImageIndex,
        totalImages: this.config.totalImages,
      },
    );
    this.toolbar.render();

    // Surface editor errors via the shell's toast
    this.on('error', (err) => {
      this.toolbar?.showToast(
        (err as Error)?.message || 'An error occurred',
        'error',
      );
    });

    if (!this.config.disableKeyboardShortcuts) {
      this.installKeyboardShortcuts();
    }
  }

  private installKeyboardShortcuts(): void {
    if (this.keydownHandler) return;
    const handler = (e: KeyboardEvent) => {
      if (this.isDestroyed) return;

      // When Fabric IText is in editing mode, keystrokes should update text,
      // not trigger global editor shortcuts.
      const active = this.fabricCanvas?.getActiveObject() as any;
      if (active?.type === 'i-text' && active?.isEditing) {
        return;
      }

      const target = e.target as HTMLElement | null;
      // Ignore when typing in an input, textarea, or contentEditable
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Undo / Redo
      if (meta && (key === 'z' || key === 'Z')) {
        e.preventDefault();
        if (shift) this.redo();
        else this.undo();
        return;
      }
      // Apply / Close
      if (meta && key === 'Enter') {
        e.preventDefault();
        this.config.onApply?.();
        return;
      }
      if (key === 'Escape') {
        this.config.onClose?.();
        return;
      }
      // Zoom
      if (!meta && (key === '+' || key === '=')) {
        e.preventDefault();
        this.zoomIn();
        return;
      }
      if (!meta && (key === '-' || key === '_')) {
        e.preventDefault();
        this.zoomOut();
        return;
      }
      if (!meta && key === '0') {
        e.preventDefault();
        this.setZoom(1);
        return;
      }
      if (!meta && key === '1') {
        e.preventDefault();
        this.setZoom(1);
        return;
      }
      // Modes
      const modeMap: Record<string, EditorMode> = {
        v: 'move',
        c: 'crop',
        b: 'draw',
        e: 'eraser',
        t: 'text',
        s: 'shape-rectangle',
      };
      if (!meta && !shift && modeMap[key.toLowerCase()]) {
        e.preventDefault();
        this.setMode(modeMap[key.toLowerCase()]);
        return;
      }
      // Rotate / Flip
      if (!meta && (key === 'r' || key === 'R')) {
        e.preventDefault();
        if (shift) this.rotateLeft();
        else this.rotateRight();
        return;
      }
      if (!meta && (key === 'h' || key === 'H')) {
        e.preventDefault();
        if (shift) this.flipVertical();
        else this.flipHorizontal();
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    this.keydownHandler = handler;
  }

  private deactivateCurrentMode(): void {
    this.drawModule?.deactivate();
    this.textModule?.deactivate();
    this.eraserModule?.deactivate();
    this.disableBrushEraser();
    this.calloutModule?.deactivate();
    this.shapeModule?.deactivate();
    // Also tear down the crop overlay (dashed rect + dimmed backdrop),
    // otherwise switching away from crop mode — or exporting via the
    // main Apply button while still in crop mode — leaves those
    // decorations stuck on the canvas and baked into the output.
    this.cropModule?.deactivate();

    if (this.fabricCanvas) {
      this.fabricCanvas.isDrawingMode = false;
      this.fabricCanvas.defaultCursor = 'default';
      this.fabricCanvas.hoverCursor = 'move';
      (this.fabricCanvas as any).freeDrawingCursor = 'crosshair';
      this.fabricCanvas.selection = false;
      // Also clear the DOM-level cursor override applied by
      // applyToolCursor() so the next mode starts fresh.
      const el = this.fabricCanvas.getElement()?.parentElement;
      if (el) el.style.cursor = '';
    }

    // Restore the ghost image after leaving crop mode (crop hides it
    // because it has its own dimmed backdrop). Any other mode we're
    // leaving didn't touch the ghost.
    if (this.currentMode === 'crop') {
      this.showGhostImage();
    }
  }

  private activateMoveMode(): void {
    if (!this.fabricCanvas) return;
    this.fabricCanvas.defaultCursor = 'grab';
    // Enable panning
    this.isPanning = false;

    // Lock every annotation (drawings, text, callouts, shapes) so a
    // drag on top of one pans the whole canvas instead of grabbing
    // that object. In Move mode only the base image should respond
    // to pointer drags; annotations must stay pinned to their
    // current position relative to the image. Users switch to the
    // corresponding tool (eraser/text/callout/etc.) to edit or
    // remove an annotation.
    this.lockAnnotations();
    // Clear any lingering active selection so the transform handles
    // don't stay drawn on an annotation the user had selected in the
    // previous tool.
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.requestRenderAll();
  }

  /**
   * Freeze every annotation object on the canvas: not selectable,
   * not evented, no hover cursor override. The base image is
   * skipped (it's already locked at install time via
   * installBaseImage()). Called by activateMoveMode() — tools that
   * need to interact with annotations (e.g. eraser) explicitly
   * re-enable them in their own activate() hook.
   */
  private lockAnnotations(): void {
    if (!this.fabricCanvas) return;
    this.fabricCanvas.getObjects().forEach((obj: any) => {
      if (obj._rpAnnotation) {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'grab';
      }
    });
  }

  /**
   * Keep freehand paths fixed like baked pixels: visible/exported but
   * never selectable or draggable.
   */
  private lockDrawPath(pathObj: any): void {
    if (!pathObj) return;
    pathObj.selectable = false;
    pathObj.evented = false;
    pathObj.hasControls = false;
    pathObj.hasBorders = false;
    pathObj.lockMovementX = true;
    pathObj.lockMovementY = true;
    pathObj.lockScalingX = true;
    pathObj.lockScalingY = true;
    pathObj.lockRotation = true;
    pathObj.hoverCursor = 'default';
  }

  private activateCropMode(): void {
    if (!this.baseImage) return;
    // Crop has its own dimmed backdrop covering everything outside the
    // crop rect; the ghost would compound with that and look wrong.
    this.hideGhostImage();
    // The toolbar visually highlights the first configured ratio chip
    // (see showCropRatioSelector) — apply that ratio here so the crop
    // rect actually matches the highlighted label instead of opening
    // as a Free crop that happens to look like the image's own ratio.
    const initialRatio = this.config.cropAspectRatios?.[0]?.value ?? null;
    this.cropModule?.activate(this.baseImage, initialRatio);
  }

  private async applyCrop(): Promise<void> {
    const result = this.cropModule?.applyCrop();
    if (!result || !this.fabricCanvas) return;

    // Snapshot of all annotation objects with their pre-crop coordinates,
    // so we can transform them to match the new cropped/re-scaled base
    // image. We DO NOT call canvas.clear() — that would wipe annotations.
    const oldAnnotations = this.fabricCanvas.getObjects().filter(
      (o: any) => o._rpAnnotation,
    );

    // Capture the old scale (canvas-px per image-px). All annotations
    // currently live in old canvas-space.
    const oldScale = result.oldDisplayScaleX || 1;
    const cropLeft = result.cropRectCanvas.left;
    const cropTop = result.cropRectCanvas.top;

    // Reload base image — loadImageOntoCanvas() removes the prior base
    // image and resizes the fabric canvas to fit the new image.
    this.fabricCanvas.backgroundColor = 'transparent';
    await this.loadImageOntoCanvas(result.dataUrl);

    // Compute new display scale from the freshly loaded base image,
    // then derive the single factor that translates + rescales every
    // annotation from old-canvas-space → new-canvas-space.
    const newScale = (this.baseImage as any)?.scaleX || 1;
    const factor = newScale / oldScale;
    // The new base image is centered inside the (wrapper-sized) canvas,
    // so annotations need this offset added on top of the crop shift.
    const newImgLeft = (this.baseImage as any)?.left || 0;
    const newImgTop = (this.baseImage as any)?.top || 0;

    for (const obj of oldAnnotations) {
      this.transformAnnotationForCrop(
        obj as fabric.Object,
        cropLeft,
        cropTop,
        factor,
        newImgLeft,
        newImgTop,
      );
    }

    // Callouts render their tail onto an off-screen canvas sized to the
    // main canvas, so after a crop (canvas resize) we need to repaint
    // every tail in the new coordinate system.
    this.calloutModule?.refreshAllTails();

    // Crop replaced the base image, so any cached rotation baselines
    // (per-annotation or image-level) no longer correspond to a real
    // unrotated state. Reset rotation tracking so the next rotate()
    // captures a fresh baseline against the cropped image.
    this.cumulativeRotation = 0;
    this.rotationImageBaseline = null;
    for (const obj of oldAnnotations) {
      delete (obj as any)._rpRotBaseline;
    }

    this.zoomLevel = 1;
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.fabricCanvas.requestRenderAll();
    this.historyModule?.saveState();
    this.setMode('move');
  }

  /**
   * Translate + rescale a single annotation from old canvas coordinates
   * (pre-crop) into new canvas coordinates (post-crop / re-fit).
   *
   *   new_pos = newImgOrigin + (old_pos - crop_origin) * factor
   *   new_scale = old_scale * factor
   *
   * `newImgLeft`/`newImgTop` are the top-left of the new base image
   * inside the new canvas (it's centered, so they're non-zero when the
   * cropped image doesn't fill the wrapper in both dimensions).
   *
   * Arrow objects store their endpoints in canvas coordinates so they
   * need a dedicated path that updates x1/y1/x2/y2 and rebuilds the bbox.
   */
  private transformAnnotationForCrop(
    obj: fabric.Object,
    cropLeft: number,
    cropTop: number,
    factor: number,
    newImgLeft: number = 0,
    newImgTop: number = 0,
  ): void {
    const anyObj = obj as any;

    // Callout tails are full-canvas fabric.Image wrappers around an
    // off-screen bitmap. They must remain pinned at the canvas origin;
    // crop/scale remapping is applied to the callout box + anchor, then
    // tails are regenerated via calloutModule.refreshAllTails().
    if (anyObj._rpType === 'callout-tail') {
      obj.set({ left: 0, top: 0, scaleX: 1, scaleY: 1 });
      obj.setCoords();
      return;
    }

    // Special-case the custom arrow object
    if (obj.type === 'rpArrow') {
      anyObj.x1 = newImgLeft + (anyObj.x1 - cropLeft) * factor;
      anyObj.y1 = newImgTop + (anyObj.y1 - cropTop) * factor;
      anyObj.x2 = newImgLeft + (anyObj.x2 - cropLeft) * factor;
      anyObj.y2 = newImgTop + (anyObj.y2 - cropTop) * factor;
      anyObj.strokeWidth = (anyObj.strokeWidth || 1) * factor;
      anyObj.arrowheadSize = (anyObj.arrowheadSize || 14) * factor;
      anyObj._updateBBox?.();
      anyObj._lastLeft = anyObj.left;
      anyObj._lastTop = anyObj.top;
      anyObj.setCoords();
      return;
    }

    // Generic Fabric objects (Circle, Ellipse, Rect, Path, IText, etc.)
    const newLeft = newImgLeft + ((obj.left || 0) - cropLeft) * factor;
    const newTop = newImgTop + ((obj.top || 0) - cropTop) * factor;
    obj.set({
      left: newLeft,
      top: newTop,
      scaleX: (obj.scaleX || 1) * factor,
      scaleY: (obj.scaleY || 1) * factor,
    });
    obj.setCoords();
  }

  private async rotate(degrees: number): Promise<void> {
    if (!this.fabricCanvas || !this.originalImageBlob) return;

    this.showLoader();
    // Yield to the browser so the loader actually paints BEFORE the
    // heavy synchronous work (canvas resize, large drawImage, Fabric
    // render) blocks the main thread.
    await this.nextPaint();
    try {
      await this.rotateInternal(degrees);
    } finally {
      this.hideLoader();
    }
  }

  private async rotateInternal(degrees: number): Promise<void> {
    if (!this.fabricCanvas || !this.originalImageBlob) return;

    // Pre-rotation cumulative angle and new cumulative angle. We always
    // rotate from the ORIGINAL image so repeated rotations never cause
    // progressive quality loss, but annotations are positioned from a
    // fixed baseline by the FULL cumulative angle to avoid drift.
    const prevCum = this.cumulativeRotation;
    const newCum = (((prevCum + degrees) % 360) + 360) % 360;

    this.deactivateCurrentMode();

    // Snapshot existing annotations BEFORE the canvas swap. We DO NOT
    // call canvas.clear() — that would wipe every annotation.
    const oldAnnotations = this.fabricCanvas.getObjects().filter(
      (o: any) => o._rpAnnotation,
    );

    // Capture old base-image geometry (canvas-pixel space) so we can
    // convert each annotation's CURRENT state back to its cum=0
    // baseline (the very first time we see it).
    const oldGeom = this.computeImageGeometry();

    // The very first rotation after load/reset/crop establishes the
    // image baseline. At that moment prevCum is 0, so the current
    // image geometry IS the cum=0 geometry.
    if (this.rotationImageBaseline === null) {
      this.rotationImageBaseline = { ...oldGeom };
    }

    // Ensure every annotation has a `_rpRotBaseline` capturing its
    // state at cum=0.
    for (const obj of oldAnnotations) {
      const anyObj = obj as any;
      if (anyObj._rpRotBaseline) continue;
      anyObj._rpRotBaseline = this.computeRotationBaseline(
        obj as fabric.Object,
        prevCum,
        oldGeom,
      );
    }

    // Commit the new cumulative angle.
    this.cumulativeRotation = newCum;

    // Resolve the source image to rotate from. We cache the decoded
    // copy across rotations so we don't re-run processImage (HEIC, EXIF
    // correction, downscale) + re-decode the bytes every step.
    let sourceImg = this.processedSourceImage;
    if (!sourceImg) {
      const { dataUrl } = await processImage(
        this.originalImageBlob,
        this.config.maxResolution,
      );
      sourceImg = await this.loadHtmlImage(dataUrl);
      this.processedSourceImage = sourceImg;
    }

    this.fabricCanvas.backgroundColor = 'transparent';

    if (newCum === 0) {
      // Full circle — reload the cached source directly (no PNG roundtrip).
      this.loadImageElementOntoCanvas(sourceImg);
    } else {
      // Render the rotated copy onto an off-screen canvas, then hand
      // the canvas STRAIGHT to Fabric (skip toDataURL/decode roundtrip
      // — saves hundreds of ms on large photos).
      const rotCanvas = document.createElement('canvas');
      const radians = (newCum * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(radians));
      const absSin = Math.abs(Math.sin(radians));
      rotCanvas.width = Math.ceil(
        sourceImg.width * absCos + sourceImg.height * absSin,
      );
      rotCanvas.height = Math.ceil(
        sourceImg.width * absSin + sourceImg.height * absCos,
      );

      const ctx = rotCanvas.getContext('2d')!;
      ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      ctx.rotate(radians);
      ctx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);

      this.loadImageElementOntoCanvas(rotCanvas);
    }

    // Post-load image geometry.
    const newGeom = this.computeImageGeometry();

    // Apply the FULL cumulative rotation to every annotation, sourced
    // from its fixed baseline — no per-step accumulation.
    const radNew = (newCum * Math.PI) / 180;
    const cosA = Math.cos(radNew);
    const sinA = Math.sin(radNew);
    const baseline = this.rotationImageBaseline!;
    const factor = baseline.scale > 0 ? newGeom.scale / baseline.scale : 1;

    for (const obj of oldAnnotations) {
      this.applyRotationFromBaseline(
        obj as fabric.Object,
        baseline,
        newGeom,
        cosA,
        sinA,
        factor,
        newCum,
      );
    }

    // Callouts render their tail onto an off-screen canvas sized to
    // the main canvas. Repaint every tail in the new coordinate system.
    this.calloutModule?.refreshAllTails();

    this.zoomLevel = 1;
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.fabricCanvas.requestRenderAll();

    this.historyModule?.saveState();
    this.setMode('move');
  }

  /**
   * Visual center + uniform display scale of the current base image
   * in canvas-pixel space.
   */
  private computeImageGeometry(): { cx: number; cy: number; scale: number } {
    if (!this.fabricCanvas) return { cx: 0, cy: 0, scale: 1 };
    if (!this.baseImage) {
      return {
        cx: this.fabricCanvas.getWidth() / 2,
        cy: this.fabricCanvas.getHeight() / 2,
        scale: 1,
      };
    }
    const scale = (this.baseImage as any).scaleX || 1;
    const scaleY = (this.baseImage as any).scaleY || scale;
    const dispW = (this.baseImage.width || 0) * scale;
    const dispH = (this.baseImage.height || 0) * scaleY;
    return {
      cx: (this.baseImage.left || 0) + dispW / 2,
      cy: (this.baseImage.top || 0) + dispH / 2,
      scale,
    };
  }

  /**
   * Build a baseline snapshot describing the annotation as it would
   * appear at cumulativeRotation === 0. If `prevCum` is non-zero the
   * snapshot is recovered by inverse-rotating the object's current
   * state around the current image center.
   *
   * Stored fields depend on the object type:
   *   - rpArrow: endpoints in baseline canvas coords + base stroke/head sizes
   *   - everything else: visual center + base scale + base angle
   */
  private computeRotationBaseline(
    obj: fabric.Object,
    prevCum: number,
    oldGeom: { cx: number; cy: number; scale: number },
  ): any {
    const baseline = this.rotationImageBaseline!;
    const invRad = (-prevCum * Math.PI) / 180;
    const cosI = Math.cos(invRad);
    const sinI = Math.sin(invRad);
    // Scale factor: oldScale -> baselineScale (i.e. shrink/grow back to
    // canvas-size at cum=0).
    const invFactor = oldGeom.scale > 0 ? baseline.scale / oldGeom.scale : 1;

    const mapBack = (px: number, py: number): { x: number; y: number } => {
      const dx = (px - oldGeom.cx) * invFactor;
      const dy = (py - oldGeom.cy) * invFactor;
      const rx = dx * cosI - dy * sinI;
      const ry = dx * sinI + dy * cosI;
      return { x: baseline.cx + rx, y: baseline.cy + ry };
    };

    const anyObj = obj as any;

    if (obj.type === 'rpArrow') {
      const p1 = mapBack(anyObj.x1, anyObj.y1);
      const p2 = mapBack(anyObj.x2, anyObj.y2);
      return {
        kind: 'arrow',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        strokeWidth: (anyObj.strokeWidth || 1) * invFactor,
        arrowheadSize: (anyObj.arrowheadSize || 14) * invFactor,
      };
    }

    const c = obj.getCenterPoint();
    const baseCenter = mapBack(c.x, c.y);
    return {
      kind: 'generic',
      cx: baseCenter.x,
      cy: baseCenter.y,
      scaleX: (obj.scaleX || 1) * invFactor,
      scaleY: (obj.scaleY || 1) * invFactor,
      angle: ((obj.angle || 0) - prevCum + 360) % 360,
    };
  }

  /**
   * Position one annotation by rotating its baseline state by the FULL
   * cumulative angle around the baseline image center, then mapping
   * into the new image center + scale.
   *
   * Callout pieces (box/border/label/anchor) keep angle=0 so the
   * axis-aligned tail-rendering logic keeps working and labels stay
   * readable. The callout-tail object is regenerated by
   * `refreshAllTails`, so we leave it alone here.
   */
  private applyRotationFromBaseline(
    obj: fabric.Object,
    baseline: { cx: number; cy: number; scale: number },
    newGeom: { cx: number; cy: number; scale: number },
    cosA: number,
    sinA: number,
    factor: number,
    newCum: number,
  ): void {
    const anyObj = obj as any;

    if (anyObj._rpType === 'callout-tail') {
      return;
    }

    const b = anyObj._rpRotBaseline;
    if (!b) return;

    const mapForward = (px: number, py: number): { x: number; y: number } => {
      const dx = px - baseline.cx;
      const dy = py - baseline.cy;
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      return {
        x: newGeom.cx + rx * factor,
        y: newGeom.cy + ry * factor,
      };
    };

    if (b.kind === 'arrow') {
      const p1 = mapForward(b.x1, b.y1);
      const p2 = mapForward(b.x2, b.y2);
      anyObj.x1 = p1.x;
      anyObj.y1 = p1.y;
      anyObj.x2 = p2.x;
      anyObj.y2 = p2.y;
      anyObj.strokeWidth = b.strokeWidth * factor;
      anyObj.arrowheadSize = b.arrowheadSize * factor;
      anyObj._updateBBox?.();
      anyObj._lastLeft = anyObj.left;
      anyObj._lastTop = anyObj.top;
      anyObj.setCoords();
      return;
    }

    const isCalloutPiece = typeof anyObj._rpType === 'string'
      && anyObj._rpType.startsWith('callout');

    obj.set({
      scaleX: b.scaleX * factor,
      scaleY: b.scaleY * factor,
    });

    if (!isCalloutPiece) {
      obj.set({ angle: ((b.angle + newCum) % 360 + 360) % 360 });
    }

    const newCenter = mapForward(b.cx, b.cy);
    obj.setPositionByOrigin(
      new fabric.Point(newCenter.x, newCenter.y),
      'center',
      'center',
    );
    obj.setCoords();
  }

  /**
   * Clamp the viewport translation so the base image can never be panned
   * fully outside the canvas. Mirrors Pintura's behaviour: the image is
   * always kept edge-to-edge with the canvas (when zoomed in the image
   * covers the canvas; when zoomed out / at fit-to-canvas it stays fully
   * within the canvas). Prevents Apply from producing a 0-byte file when
   * the user panned the image completely out of view.
   */
  private clampViewportPan(): void {
    if (!this.fabricCanvas || !this.baseImage) return;
    const canvas = this.fabricCanvas;
    const vpt = canvas.viewportTransform;
    if (!vpt) return;

    const zoom = canvas.getZoom() || 1;
    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();

    const scaleX = (this.baseImage as any).scaleX || 1;
    const scaleY = (this.baseImage as any).scaleY || 1;
    const imgLeft = (this.baseImage as any).left || 0;
    const imgTop = (this.baseImage as any).top || 0;
    const imgDisplayW = (this.baseImage.width || 0) * scaleX;
    const imgDisplayH = (this.baseImage.height || 0) * scaleY;

    if (imgDisplayW <= 0 || imgDisplayH <= 0) return;

    // For each axis independently, compute the allowed translation range
    // such that the image edges stay flush with (or inside) the canvas
    // edges. Case A (image larger than canvas): keep canvas fully covered
    // by the image. Case B (image smaller than canvas): keep the image
    // fully inside the canvas.
    const clampAxis = (
      tx: number,
      imgOffset: number,
      imgSize: number,
      canvasSize: number,
    ): number => {
      const screenSize = imgSize * zoom;
      let minTx: number;
      let maxTx: number;
      if (screenSize >= canvasSize) {
        // screenRight >= canvasSize AND screenLeft <= 0
        minTx = canvasSize - (imgOffset + imgSize) * zoom;
        maxTx = -imgOffset * zoom;
      } else {
        // screenLeft >= 0 AND screenRight <= canvasSize
        minTx = -imgOffset * zoom;
        maxTx = canvasSize - (imgOffset + imgSize) * zoom;
      }
      if (minTx > maxTx) {
        // Degenerate — center the image
        return (minTx + maxTx) / 2;
      }
      return Math.min(maxTx, Math.max(minTx, tx));
    };

    const newTx = clampAxis(vpt[4], imgLeft, imgDisplayW, canvasW);
    const newTy = clampAxis(vpt[5], imgTop, imgDisplayH, canvasH);

    if (newTx !== vpt[4] || newTy !== vpt[5]) {
      vpt[4] = newTx;
      vpt[5] = newTy;
      canvas.setViewportTransform(vpt);
    }
  }

  private setupGestureHandlers(): void {
    if (!this.fabricCanvas) return;

    const canvas = this.fabricCanvas;

    // Mouse/touch panning in move mode
    canvas.on('mouse:down', (opt: fabric.IEvent<MouseEvent>) => {
      if (this.currentMode === 'move' && !opt.target) {
        this.isPanning = true;
        const e = opt.e as any;
        this.lastPanX = e.clientX || e.touches?.[0]?.clientX || 0;
        this.lastPanY = e.clientY || e.touches?.[0]?.clientY || 0;
        canvas.defaultCursor = 'grabbing';
      }
    });

    canvas.on('mouse:move', (opt: fabric.IEvent<MouseEvent>) => {
      if (this.isPanning && this.currentMode === 'move') {
        const e = opt.e as any;
        const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
        const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

        const deltaX = clientX - this.lastPanX;
        const deltaY = clientY - this.lastPanY;

        const vpt = canvas.viewportTransform!;
        vpt[4] += deltaX;
        vpt[5] += deltaY;
        canvas.setViewportTransform(vpt);
        // Constrain so the base image cannot leave the canvas area.
        this.clampViewportPan();

        this.lastPanX = clientX;
        this.lastPanY = clientY;
        this.updateGhostImagePosition();
      }
    });

    canvas.on('mouse:up', () => {
      this.isPanning = false;
      if (this.currentMode === 'move') {
        canvas.defaultCursor = 'grab';
      }
    });

    // Scroll wheel zoom
    canvas.on('mouse:wheel', (opt: fabric.IEvent<WheelEvent>) => {
      const delta = (opt.e as WheelEvent).deltaY;
      let newZoom = this.zoomLevel * (delta > 0 ? 0.95 : 1.05);
      newZoom = Math.max(
        RpImageEditor.MIN_ZOOM,
        Math.min(RpImageEditor.MAX_ZOOM, newZoom),
      );

      const pointer = canvas.getPointer(opt.e, true);
      canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), newZoom);
      this.clampViewportPan();
      this.zoomLevel = newZoom; this.toolbar?.updateZoomState(newZoom); this.emit('zoom:changed', newZoom);
      this.updateGhostImagePosition();

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Touch gesture handling (pinch to zoom)
    if (isTouchDevice()) {
      this.setupTouchGestures();
    }
  }

  private setupTouchGestures(): void {
    const upperCanvas = this.fabricCanvas?.getElement()?.parentElement;
    if (!upperCanvas) return;

    let activeTouches: Touch[] = [];

    upperCanvas.addEventListener('touchstart', (e: TouchEvent) => {
      activeTouches = Array.from(e.touches);
      if (activeTouches.length === 2) {
        this.lastPinchDistance = this.getTouchDistance(activeTouches[0], activeTouches[1]);
        e.preventDefault();
      }
    }, { passive: false });

    upperCanvas.addEventListener('touchmove', (e: TouchEvent) => {
      activeTouches = Array.from(e.touches);
      if (activeTouches.length === 2 && this.fabricCanvas) {
        const dist = this.getTouchDistance(activeTouches[0], activeTouches[1]);
        if (this.lastPinchDistance > 0) {
          const scale = dist / this.lastPinchDistance;
          const newZoom = Math.max(
            RpImageEditor.MIN_ZOOM,
            Math.min(RpImageEditor.MAX_ZOOM, this.zoomLevel * scale),
          );

          const midX = (activeTouches[0].clientX + activeTouches[1].clientX) / 2;
          const midY = (activeTouches[0].clientY + activeTouches[1].clientY) / 2;

          const rect = upperCanvas.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;

          this.fabricCanvas.zoomToPoint(new fabric.Point(canvasX, canvasY), newZoom);
          this.clampViewportPan();
          this.zoomLevel = newZoom;
          this.toolbar?.updateZoomState(newZoom);
          this.emit('zoom:changed', newZoom);
          this.updateGhostImagePosition();
        }
        this.lastPinchDistance = dist;
        e.preventDefault();
      }
    }, { passive: false });

    upperCanvas.addEventListener('touchend', () => {
      this.lastPinchDistance = 0;
    });
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private setupResizeObserver(): void {
    if (!this.wrapperEl || !this.fabricCanvas) return;

    const resizeObserver = new ResizeObserver(() => {
      if (this.isDestroyed || !this.wrapperEl || !this.fabricCanvas || !this.baseImage) return;

      const rect = this.wrapperEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Capture the OLD base-image geometry before mutating anything.
        // Annotations (draw paths, shapes, text, callouts) are positioned
        // in canvas pixel coordinates, so when the base image is rescaled
        // to fit the new wrapper (e.g. entering/exiting fullscreen) we
        // must apply the same translation+scale to every annotation or
        // they drift off the image.
        const oldLeft = this.baseImage.left || 0;
        const oldTop = this.baseImage.top || 0;
        const oldScale = this.baseImage.scaleX || 1;

        // Recalculate the image fit within the new wrapper size
        const availW = Math.floor(rect.width);
        const availH = Math.floor(rect.height);
        const imgW = this.baseImage.width || availW;
        const imgH = this.baseImage.height || availH;
        // Allow scale > 1 so small images fill the stage on resize too.
        const scale = Math.min(availW / imgW, availH / imgH);
        const displayW = Math.round(imgW * scale);
        const displayH = Math.round(imgH * scale);

        // Canvas fills wrapper; image centered inside (see installBaseImage)
        const canvasW = availW;
        const canvasH = availH;
        this.fabricCanvas.setWidth(canvasW);
        this.fabricCanvas.setHeight(canvasH);

        const newLeft = Math.round((canvasW - displayW) / 2);
        const newTop = Math.round((canvasH - displayH) / 2);
        const newScale = displayW / imgW;

        this.baseImage.set({
          left: newLeft,
          top: newTop,
          scaleX: newScale,
          scaleY: displayH / imgH,
        });
        this.baseImage.setCoords();

        // Reposition + rescale every non-base object so annotations stay
        // anchored to the same point on the image. We treat the base
        // image's top-left as the reference origin and apply a uniform
        // scale ratio (X and Y are always equal here — Math.min above).
        if (oldScale > 0 && Math.abs(newScale - oldScale) > 1e-6) {
          const ratio = newScale / oldScale;
          this.fabricCanvas.getObjects().forEach((obj: any) => {
            if (obj === this.baseImage || obj._rpBaseImage) return;
            const objLeft = obj.left || 0;
            const objTop = obj.top || 0;
            obj.set({
              left: newLeft + (objLeft - oldLeft) * ratio,
              top: newTop + (objTop - oldTop) * ratio,
              scaleX: (obj.scaleX || 1) * ratio,
              scaleY: (obj.scaleY || 1) * ratio,
            });
            obj.setCoords();
          });
        } else if (Math.abs(newLeft - oldLeft) > 0.5 || Math.abs(newTop - oldTop) > 0.5) {
          // Scale unchanged but the letterbox offset shifted (e.g. only
          // aspect ratio of the wrapper changed) — translate annotations
          // by the delta so they follow the base image.
          const dx = newLeft - oldLeft;
          const dy = newTop - oldTop;
          this.fabricCanvas.getObjects().forEach((obj: any) => {
            if (obj === this.baseImage || obj._rpBaseImage) return;
            obj.set({
              left: (obj.left || 0) + dx,
              top: (obj.top || 0) + dy,
            });
            obj.setCoords();
          });
        }

        this.fabricCanvas.renderAll();
        this.refreshGhostImage();
      }
    });

    resizeObserver.observe(this.wrapperEl);
  }

  private refreshBaseImageRef(): void {
    if (!this.fabricCanvas) return;
    this.baseImage = this.fabricCanvas.getObjects().find(
      (o: any) => o._rpBaseImage
    ) as fabric.Image || null;

    // After loadFromJSON (undo/redo) the base image is a fresh Fabric
    // object rebuilt from serialized state. Serialized `selectable` /
    // `evented` don't reliably round-trip, so the restored base image can
    // become user-draggable — the user then drags the image itself
    // instead of panning the viewport, moves it off the canvas, and
    // Apply produces a garbled/blank export. Re-lock the base image
    // every time we refresh the reference.
    if (this.baseImage) {
      this.baseImage.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: this.currentMode === 'move' ? 'grab' : 'default',
      } as any);
      this.baseImage.setCoords();
      this.baseImage.sendToBack();

      // Any lingering active selection (e.g. the restored base image
      // showing selection handles) must be cleared, otherwise the user
      // sees the ghost through the "selected" base image.
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();
    }

    // Undo/redo swaps the base image object out from under us — rebuild
    // the ghost so it reflects the restored state.
    if (this.currentMode !== 'crop') {
      this.refreshGhostImage();
    }

    // Re-clamp the viewport in case the previously-clamped pan is now
    // outside the newly restored image bounds.
    this.clampViewportPan();
  }

  private loadHtmlImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  /**
   * Convert a hex or rgb color into an rgba() string with the given
   * alpha in [0..1]. Falls back to the raw color when parsing fails
   * so DrawModule still receives a valid CSS color.
   */
  private colorWithAlpha(color: string, alpha: number): string {
    const s = color.trim().toLowerCase();
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      const h =
        hex.length === 3
          ? hex.split('').map((c) => c + c).join('')
          : hex;
      if (h.length === 6) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        if (![r, g, b].some(Number.isNaN)) {
          return `rgba(${r},${g},${b},${alpha})`;
        }
      }
    }
    const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
    }
    return color;
  }

  private async base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
    const response = await fetch(base64);
    return response.blob();
  }

  /**
   * Show a translucent overlay with a spinner on top of the canvas
   * wrapper. Used while a slow op (e.g. rotating a very large photo)
   * is in flight so the UI feels responsive instead of frozen.
   */
  private showLoader(): void {
    if (!this.wrapperEl || this.loaderEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'rp-editor-loader rp-ie-loader';
    overlay.innerHTML = `
      <div class="rp-ie-loader__glass">
        <span class="rp-ie-loader__spinner" aria-hidden="true"></span>
        <span class="rp-ie-loader__label">Processing image…</span>
      </div>
    `;

    // Inject fallback keyframes once (theme CSS also ships them; this
    // keeps the loader working when consumers don't load the stylesheet).
    if (!document.getElementById('rp-editor-spin-style')) {
      const style = document.createElement('style');
      style.id = 'rp-editor-spin-style';
      style.textContent =
        '@keyframes rp-editor-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    const computed = getComputedStyle(this.wrapperEl);
    if (computed.position === 'static') {
      this.wrapperEl.style.position = 'relative';
    }
    this.wrapperEl.appendChild(overlay);
    this.loaderEl = overlay;
  }

  private hideLoader(): void {
    if (this.loaderEl) {
      this.loaderEl.remove();
      this.loaderEl = null;
    }
  }

  /**
   * Swap the Fabric canvas cursor for a tool-specific icon so drawing
   * feels like a pencil / erasing feels like an eraser instead of the
   * generic `crosshair` (+). We override both `defaultCursor` (idle)
   * and `freeDrawingCursor` (which Fabric flips to `crosshair` when
   * `isDrawingMode` toggles on) with inline SVG data URIs — no extra
   * assets to bundle. Hotspot is the pencil tip / eraser tip.
   */
  private applyToolCursor(tool: 'pencil' | 'eraser'): void {
    if (!this.fabricCanvas) return;
    const cursor = tool === 'pencil'
      ? this.buildPencilCursor()
      : this.buildEraserCursor();
    this.fabricCanvas.defaultCursor = cursor;
    this.fabricCanvas.hoverCursor = cursor;
    (this.fabricCanvas as any).freeDrawingCursor = cursor;
    // Also apply directly to the DOM element so it takes effect
    // immediately (Fabric only refreshes cursor on mouse events).
    const el = this.fabricCanvas.getElement()?.parentElement;
    if (el) el.style.cursor = cursor;
  }

  private buildPencilCursor(): string {
    // Pencil pointing down-left; tip lands at hotspot (2, 22).
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M14.5 3.5l6 6-11 11H3.5v-6z' fill='%23FFDF6F' stroke='%23111'/><path d='M12.5 5.5l6 6' stroke='%23111'/><path d='M3.5 14.5l6 6' stroke='%23111'/><path d='M3.5 20.5l3-1 -2-2z' fill='%23111'/></svg>`;
    return `url("data:image/svg+xml;utf8,${svg}") 2 22, crosshair`;
  }

  private buildEraserCursor(): string {
    // Eraser body; hotspot at bottom-left tip (4, 20).
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4 15l7-7 7 7-4 4H8z' fill='%23FFB4A9' stroke='%23111'/><path d='M8 19h9' stroke='%23111'/><path d='M11 8l7 7' stroke='%23111'/></svg>`;
    return `url("data:image/svg+xml;utf8,${svg}") 4 20, crosshair`;
  }

  /**
   * Layer drag-through erasing on top of the eraser module's
   * click-to-delete behaviour. Down/move fires a hit test around the
   * pointer (radius = eraser width) and removes every annotation whose
   * bounds intersect the eraser circle — so users can sweep a stroke
   * across drawings to wipe them out, matching the drawing feel.
   * A small circle follows the cursor so the user sees the affected
   * area.
   */
  private enableBrushEraser(): void {
    if (!this.fabricCanvas || !this.wrapperEl) return;
    this.disableBrushEraser();

    const canvas = this.fabricCanvas;

    // Cursor circle overlay (visual size indicator)
    const halo = document.createElement('div');
    halo.className = 'rp-editor-eraser-halo';
    halo.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'border:1.5px solid rgba(255,255,255,0.85)',
      'box-shadow:0 0 0 1px rgba(0,0,0,0.35)',
      'border-radius:50%',
      'z-index:5',
      'transform:translate(-50%,-50%)',
      'opacity:0',
      'transition:opacity 120ms ease',
    ].join(';');
    if (getComputedStyle(this.wrapperEl).position === 'static') {
      this.wrapperEl.style.position = 'relative';
    }
    this.wrapperEl.appendChild(halo);
    this.eraserCursorEl = halo;

    const positionHalo = (clientX: number, clientY: number): void => {
      if (!this.eraserCursorEl || !this.wrapperEl) return;
      const w = this.eraserModule?.getEraserWidth?.() ?? 20;
      const rect = this.wrapperEl.getBoundingClientRect();
      this.eraserCursorEl.style.width = `${w}px`;
      this.eraserCursorEl.style.height = `${w}px`;
      this.eraserCursorEl.style.left = `${clientX - rect.left}px`;
      this.eraserCursorEl.style.top = `${clientY - rect.top}px`;
    };

    const showHalo = () => {
      if (this.eraserCursorEl) this.eraserCursorEl.style.opacity = '1';
    };
    const hideHalo = () => {
      if (this.eraserCursorEl) this.eraserCursorEl.style.opacity = '0';
    };

    const eraseAtPointer = (opt: fabric.IEvent<MouseEvent | TouchEvent>): boolean => {
      const pointer = canvas.getPointer(opt.e as any, false);
      const radius = ((this.eraserModule?.getEraserWidth?.() ?? 20) / 2);
      const objects = canvas.getObjects();
      let removed = false;

      // Callouts are removed as a unit through the callout module so all
      // 5 fabric objects (tail bitmap, border, box, label, anchor) go
      // together. The module also does per-pixel hit-testing on the
      // full-canvas tail bitmap so we don't wipe out a callout just
      // because the cursor happens to be over its bounding rect.
      if (this.calloutModule) {
        let cid: number | null;
        while (
          (cid = this.calloutModule.getCalloutIdAtPoint(
            pointer.x,
            pointer.y,
            radius,
          )) != null
        ) {
          if (!this.calloutModule.removeCalloutById(cid)) break;
          removed = true;
        }
      }

      for (const obj of objects) {
        const anyObj = obj as any;
        if (!anyObj._rpAnnotation) continue;
        // Callout parts are handled above.
        if (anyObj.calloutId != null) continue;
        const b = obj.getBoundingRect(true, true);
        // Inflate bbox by radius so we hit near-misses like the user
        // would expect from a real eraser.
        const hit =
          pointer.x >= b.left - radius &&
          pointer.x <= b.left + b.width + radius &&
          pointer.y >= b.top - radius &&
          pointer.y <= b.top + b.height + radius;
        if (hit) {
          canvas.remove(obj);
          removed = true;
        }
      }
      if (removed) canvas.requestRenderAll();
      return removed;
    };

    this.eraserBrushHandlers = {
      down: (opt) => {
        if (this.currentMode !== 'eraser') return;
        this.isErasing = true;
        this.eraserDidRemove = eraseAtPointer(opt);
      },
      move: (opt) => {
        if (this.currentMode !== 'eraser') return;
        const e = opt.e as any;
        const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        positionHalo(cx, cy);
        showHalo();
        if (this.isErasing) {
          const removed = eraseAtPointer(opt);
          this.eraserDidRemove = this.eraserDidRemove || removed;
        }
      },
      up: () => {
        if (this.currentMode !== 'eraser') return;
        if (this.isErasing && this.eraserDidRemove) {
          this.historyModule?.saveState();
        }
        this.isErasing = false;
        this.eraserDidRemove = false;
      },
      out: () => hideHalo(),
    };

    canvas.on('mouse:down', this.eraserBrushHandlers.down);
    canvas.on('mouse:move', this.eraserBrushHandlers.move);
    canvas.on('mouse:up', this.eraserBrushHandlers.up);
    canvas.on('mouse:out', this.eraserBrushHandlers.out);
  }

  private disableBrushEraser(): void {
    if (this.fabricCanvas && this.eraserBrushHandlers) {
      this.fabricCanvas.off('mouse:down', this.eraserBrushHandlers.down as any);
      this.fabricCanvas.off('mouse:move', this.eraserBrushHandlers.move as any);
      this.fabricCanvas.off('mouse:up', this.eraserBrushHandlers.up as any);
      this.fabricCanvas.off('mouse:out', this.eraserBrushHandlers.out as any);
    }
    this.eraserBrushHandlers = null;
    if (this.eraserCursorEl) {
      this.eraserCursorEl.remove();
      this.eraserCursorEl = null;
    }
    this.isErasing = false;
    this.eraserDidRemove = false;
  }

  /**
   * Mount a translucent copy of the current base image in the wrapper,
   * positioned to align with the on-canvas image. Because the Fabric
   * canvas is sized exactly to the visible image, this "ghost" is what
   * makes the parts of the image panned outside the canvas still
   * visible (faded) in move mode — giving the user a preview of what
   * will be cropped away on Apply, similar to the crop tool's dimmed
   * backdrop.
   */
  private showGhostImage(): void {
    if (!this.wrapperEl || !this.baseImage) return;
    this.hideGhostImage();

    const el = this.baseImage.getElement() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;
    if (!el) return;

    let src: string;
    try {
      if (el instanceof HTMLCanvasElement) {
        src = el.toDataURL();
      } else {
        src = (el as HTMLImageElement).src;
      }
    } catch {
      // Tainted canvas or missing element — skip the ghost rather than crash.
      return;
    }
    if (!src) return;

    const ghost = document.createElement('img');
    ghost.src = src;
    ghost.draggable = false;
    ghost.alt = '';
    ghost.className = 'rp-editor-ghost-image';
    ghost.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'pointer-events:none',
      'opacity:0.28',
      'z-index:0',
      'transform-origin:top left',
      '-webkit-user-select:none',
      'user-select:none',
      '-webkit-user-drag:none',
    ].join(';');

    // Ensure the Fabric canvas-container renders above the ghost.
    const fabricContainer = this.wrapperEl.querySelector(
      '.canvas-container',
    ) as HTMLElement | null;
    if (fabricContainer) {
      if (getComputedStyle(fabricContainer).position === 'static') {
        fabricContainer.style.position = 'relative';
      }
      fabricContainer.style.zIndex = '1';
    }

    if (getComputedStyle(this.wrapperEl).position === 'static') {
      this.wrapperEl.style.position = 'relative';
    }

    this.wrapperEl.insertBefore(ghost, this.wrapperEl.firstChild);
    this.ghostImageEl = ghost;
    this.updateGhostImagePosition();
  }

  private hideGhostImage(): void {
    if (this.ghostImageEl) {
      this.ghostImageEl.remove();
      this.ghostImageEl = null;
    }
  }

  /**
   * Rebuild the ghost image (source + position) — used when the base
   * image changes (undo/redo, resize) while move mode is active.
   */
  private refreshGhostImage(): void {
    if (!this.ghostImageEl) return;
    this.showGhostImage();
  }

  /**
   * Keep the ghost image aligned with the on-canvas image after any
   * pan, zoom, or wrapper resize.
   */
  private updateGhostImagePosition(): void {
    if (
      !this.ghostImageEl ||
      !this.wrapperEl ||
      !this.fabricCanvas ||
      !this.baseImage
    ) {
      return;
    }
    const wrapperRect = this.wrapperEl.getBoundingClientRect();
    const canvasW = this.fabricCanvas.getWidth();
    const canvasH = this.fabricCanvas.getHeight();
    // The Fabric canvas is centered inside the wrapper via flex.
    const canvasLeft = Math.max(0, (wrapperRect.width - canvasW) / 2);
    const canvasTop = Math.max(0, (wrapperRect.height - canvasH) / 2);
    const vpt = this.fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const zoom = vpt[0] || 1;
    const tx = vpt[4] || 0;
    const ty = vpt[5] || 0;

    const scale = (this.baseImage as any).scaleX || 1;
    const scaleY = (this.baseImage as any).scaleY || scale;
    const dispW = (this.baseImage.width || 0) * scale;
    const dispH = (this.baseImage.height || 0) * scaleY;

    // The base image's own left/top inside the canvas (post-centering
    // it's non-zero). After the viewport transform it lands at
    // (tx + imgLeft*zoom, ty + imgTop*zoom) on screen, then offset by
    // the canvas's position inside the wrapper.
    const imgLeft = (this.baseImage as any).left || 0;
    const imgTop = (this.baseImage as any).top || 0;
    const left = canvasLeft + tx + imgLeft * zoom;
    const top = canvasTop + ty + imgTop * zoom;
    const width = dispW * zoom;
    const height = dispH * zoom;

    this.ghostImageEl.style.left = `${left}px`;
    this.ghostImageEl.style.top = `${top}px`;
    this.ghostImageEl.style.width = `${width}px`;
    this.ghostImageEl.style.height = `${height}px`;
  }

  /**
   * Resolve after the next paint so an overlay added immediately
   * before this call is actually visible before subsequent heavy
   * synchronous work blocks the main thread.
   */
  private nextPaint(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      } else {
        setTimeout(resolve, 16);
      }
    });
  }
}
