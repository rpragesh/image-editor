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

export class RpImageEditor extends EventEmitter<RpEditorEvents> {
  private config: ReturnType<typeof mergeConfig>;
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

  constructor(container: HTMLElement, config?: Partial<RpEditorConfig>) {
    super();
    this.container = container;
    this.config = mergeConfig(config);
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

      // Render toolbar
      if (this.config.showToolbar) {
        this.renderToolbar();
      }

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
        break;
      case 'text':
        this.textModule?.activate();
        break;
      case 'eraser':
        this.eraserModule?.activate();
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
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.zoomLevel = clampedLevel;

    if (this.fabricCanvas) {
      const center = this.fabricCanvas.getCenter();
      this.fabricCanvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        clampedLevel
      );
      this.fabricCanvas.renderAll();
    }

    this.toolbar?.updateZoomState(clampedLevel);
    this.emit('zoom:changed', clampedLevel);
  }

  /**
   * Rotate left (−90°)
   */
  async rotateLeft(): Promise<void> {
    await this.rotate(-45);
  }

  /**
   * Rotate right (+90°)
   */
  async rotateRight(): Promise<void> {
    await this.rotate(45);
  }

  /**
   * Undo last action
   */
  async undo(): Promise<void> {
    await this.historyModule?.undo();
    this.refreshBaseImageRef();
  }

  /**
   * Redo last undone action
   */
  async redo(): Promise<void> {
    await this.historyModule?.redo();
    this.refreshBaseImageRef();
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
    this.drawModule?.setBrushColor(color);
    this.textModule?.setTextColor(color);
    this.calloutModule?.setColor(color);
    this.shapeModule?.setStrokeColor(color);
  }

  /**
   * Set brush width
   */
  setBrushWidth(width: number): void {
    this.drawModule?.setBrushWidth(width);
    this.shapeModule?.setStrokeWidth(width);
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

    // If zoom is 1× and no pan, export the full image region (backwards-compatible)
    const isDefaultView = zoom === 1 && vpt[4] === 0 && vpt[5] === 0;
    const exportLeft = isDefaultView ? imgLeft : visLeft;
    const exportTop = isDefaultView ? imgTop : visTop;
    const exportW = isDefaultView ? imgDisplayW : visWidth;
    const exportH = isDefaultView ? imgDisplayH : visHeight;

    // Reset viewport for clean rendering — we handle the offset manually
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.fabricCanvas.setZoom(1);

    // Use an offscreen canvas to render ONLY the visible image region.
    const offW = Math.round(exportW * multiplier);
    const offH = Math.round(exportH * multiplier);
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
    this.toolbar?.destroy();
    this.fabricCanvas?.dispose();
    this.removeAllListeners();

    if (this.wrapperEl) {
      this.wrapperEl.innerHTML = '';
      this.wrapperEl.remove();
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
      flex: 1;
      position: relative;
      overflow: hidden;
      background: ${this.config.theme.editorBackground || '#e0e0e0'};
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

    // Insert before toolbar area
    this.container.insertBefore(this.wrapperEl, this.container.firstChild);

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

    // Scale image to fit within the available area (uniform scale)
    const scale = Math.min(availW / imgW, availH / imgH, 1);
    const displayW = Math.round(imgW * scale);
    const displayH = Math.round(imgH * scale);

    // Resize the Fabric canvas to exactly match the scaled image
    this.fabricCanvas.setWidth(displayW);
    this.fabricCanvas.setHeight(displayH);

    // Place image at origin with explicit scaleX/scaleY (avoid
    // scaleToWidth/scaleToHeight which both do uniform scaling
    // and the second call overrides the first).
    img.set({
      left: 0,
      top: 0,
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
    this.fabricCanvas.renderAll();
  }

  private initializeModules(): void {
    if (!this.fabricCanvas) return;

    this.cropModule = new CropModule(this.fabricCanvas);
    this.drawModule = new DrawModule(this.fabricCanvas);
    this.textModule = new TextModule(this.fabricCanvas);
    this.eraserModule = new EraserModule(this.fabricCanvas);
    this.calloutModule = new CalloutModule(this.fabricCanvas);
    this.shapeModule = new ShapeModule(this.fabricCanvas);
    this.historyModule = new HistoryModule(this.fabricCanvas, this.config.maxUndoSteps);

    // Set defaults from config

    this.drawModule?.setBrushColor(this.config.defaultBrushColor);
    this.drawModule?.setBrushWidth(this.config.defaultBrushWidth);
    this.textModule?.setTextColor(this.config.defaultTextColor);
    this.textModule?.setFontSize(this.config.defaultTextFontSize);
    this.calloutModule?.setColor(this.config.defaultBrushColor);
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
        }
      });
      this.historyModule?.saveState();
    });

    // Listen for text editing completion
    this.fabricCanvas.on('text:editing:exited', () => {
      this.historyModule?.saveState();
    });

    // Listen for object modifications
    this.fabricCanvas.on('object:modified', () => {
      this.historyModule?.saveState();
    });

    // Listen for object removal (eraser)
    this.fabricCanvas.on('object:removed', (e: any) => {
      if (e.target?._rpAnnotation) {
        this.historyModule?.saveState();
      }
    });

    // Listen for callout / annotation additions
    this.fabricCanvas.on('object:added', (e: any) => {
      if (e.target?._rpType?.startsWith('callout')) {
        this.historyModule?.saveState();
      }
    });

    // Setup history change notifications
    this.historyModule.onChange((state) => {
      this.toolbar?.updateHistoryState(state.canUndo, state.canRedo);
      this.emit('history:changed', state);
    });
  }

  private renderToolbar(): void {
    if (!this.config.showToolbar) return;

    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'rp-editor-toolbar-container';
    this.container.appendChild(toolbarContainer);

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
    };

    this.toolbar = new Toolbar(
      toolbarContainer,
      this.config.theme,
      this.config.colorPalette,
      this.config.cropAspectRatios,
      callbacks,
      this.config.disabledFeatures
    );
    this.toolbar.render();
    // Disable zoom-out button initially since zoom starts at 1×
    this.toolbar.updateZoomState(this.zoomLevel);
  }

  private deactivateCurrentMode(): void {
    this.drawModule?.deactivate();
    this.textModule?.deactivate();
    this.eraserModule?.deactivate();
    this.calloutModule?.deactivate();
    this.shapeModule?.deactivate();

    if (this.fabricCanvas) {
      this.fabricCanvas.isDrawingMode = false;
      this.fabricCanvas.defaultCursor = 'default';
      this.fabricCanvas.selection = false;
    }
  }

  private activateMoveMode(): void {
    if (!this.fabricCanvas) return;
    this.fabricCanvas.defaultCursor = 'grab';
    // Enable panning
    this.isPanning = false;
  }

  private activateCropMode(): void {
    if (!this.baseImage) return;
    this.cropModule?.activate(this.baseImage);
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

    for (const obj of oldAnnotations) {
      this.transformAnnotationForCrop(obj as fabric.Object, cropLeft, cropTop, factor);
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
   *   new_pos = (old_pos - crop_origin) * factor
   *   new_scale = old_scale * factor
   *
   * Arrow objects store their endpoints in canvas coordinates so they
   * need a dedicated path that updates x1/y1/x2/y2 and rebuilds the bbox.
   */
  private transformAnnotationForCrop(
    obj: fabric.Object,
    cropLeft: number,
    cropTop: number,
    factor: number,
  ): void {
    const anyObj = obj as any;

    // Special-case the custom arrow object
    if (obj.type === 'rpArrow') {
      anyObj.x1 = (anyObj.x1 - cropLeft) * factor;
      anyObj.y1 = (anyObj.y1 - cropTop) * factor;
      anyObj.x2 = (anyObj.x2 - cropLeft) * factor;
      anyObj.y2 = (anyObj.y2 - cropTop) * factor;
      anyObj.strokeWidth = (anyObj.strokeWidth || 1) * factor;
      anyObj.arrowheadSize = (anyObj.arrowheadSize || 14) * factor;
      anyObj._updateBBox?.();
      anyObj._lastLeft = anyObj.left;
      anyObj._lastTop = anyObj.top;
      anyObj.setCoords();
      return;
    }

    // Generic Fabric objects (Circle, Ellipse, Rect, Path, IText, etc.)
    const newLeft = ((obj.left || 0) - cropLeft) * factor;
    const newTop = ((obj.top || 0) - cropTop) * factor;
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

        this.lastPanX = clientX;
        this.lastPanY = clientY;
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
      newZoom = Math.max(1, Math.min(5, newZoom));

      const pointer = canvas.getPointer(opt.e, true);
      canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), newZoom);
      this.zoomLevel = newZoom; this.toolbar?.updateZoomState(newZoom); this.emit('zoom:changed', newZoom);

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
          const newZoom = Math.max(1, Math.min(5, this.zoomLevel * scale));

          const midX = (activeTouches[0].clientX + activeTouches[1].clientX) / 2;
          const midY = (activeTouches[0].clientY + activeTouches[1].clientY) / 2;

          const rect = upperCanvas.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;

          this.fabricCanvas.zoomToPoint(new fabric.Point(canvasX, canvasY), newZoom);
          this.zoomLevel = newZoom;
          this.toolbar?.updateZoomState(newZoom);
          this.emit('zoom:changed', newZoom);
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
        // Recalculate the image fit within the new wrapper size
        const availW = Math.floor(rect.width);
        const availH = Math.floor(rect.height);
        const imgW = this.baseImage.width || availW;
        const imgH = this.baseImage.height || availH;
        const scale = Math.min(availW / imgW, availH / imgH, 1);
        const displayW = Math.round(imgW * scale);
        const displayH = Math.round(imgH * scale);

        this.fabricCanvas.setWidth(displayW);
        this.fabricCanvas.setHeight(displayH);

        // Reposition and rescale the base image with explicit scaleX/scaleY
        this.baseImage.set({
          left: 0,
          top: 0,
          scaleX: displayW / imgW,
          scaleY: displayH / imgH,
        });

        this.fabricCanvas.renderAll();
      }
    });

    resizeObserver.observe(this.wrapperEl);
  }

  private refreshBaseImageRef(): void {
    if (!this.fabricCanvas) return;
    this.baseImage = this.fabricCanvas.getObjects().find(
      (o: any) => o._rpBaseImage
    ) as fabric.Image || null;
  }

  private loadHtmlImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
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
    overlay.className = 'rp-editor-loader';
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(255,255,255,0.55)',
      'backdrop-filter:blur(2px)',
      '-webkit-backdrop-filter:blur(2px)',
      'z-index:9999',
      'pointer-events:all',
      'cursor:progress',
    ].join(';');

    const spinner = document.createElement('div');
    spinner.style.cssText = [
      'width:36px',
      'height:36px',
      'border:3px solid rgba(0,0,0,0.15)',
      'border-top-color:#4a90d9',
      'border-radius:50%',
      'animation:rp-editor-spin 0.8s linear infinite',
    ].join(';');

    // Inject keyframes once.
    if (!document.getElementById('rp-editor-spin-style')) {
      const style = document.createElement('style');
      style.id = 'rp-editor-spin-style';
      style.textContent =
        '@keyframes rp-editor-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    overlay.appendChild(spinner);
    // Make sure the wrapper is the positioning context.
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
