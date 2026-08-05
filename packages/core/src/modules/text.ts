/**
 * Text Module — add and edit text annotations on the canvas
 */
import { fabric } from 'fabric';

export class TextModule {
  private canvas: fabric.Canvas;
  private textColor = '#ff0000';
  private fontSize = 24;
  private fontFamily = 'Arial, Helvetica, sans-serif';
  private isActive = false;
  private pendingTextAdd = false;
  private boundsProvider:
    | (() => { left: number; top: number; right: number; bottom: number } | null)
    | null = null;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  /**
   * Activate text mode — next tap on canvas adds text
   */
  activate(): void {
    this.isActive = true;
    this.pendingTextAdd = true;
    this.canvas.isDrawingMode = false;
    this.canvas.defaultCursor = 'text';

    // Listen for click to place text
    this.canvas.on('mouse:down', this.handleCanvasClick);
  }

  /**
   * Deactivate text mode
   */
  deactivate(): void {
    this.isActive = false;
    this.pendingTextAdd = false;
    this.canvas.defaultCursor = 'default';
    this.canvas.off('mouse:down', this.handleCanvasClick);
  }

  /**
   * Add text at a specific position (or center of canvas)
   */
  addText(options?: {
    text?: string;
    color?: string;
    fontSize?: number;
    left?: number;
    top?: number;
  }): fabric.IText {
    const text = new fabric.IText(options?.text || 'Text', {
      left: options?.left ?? this.canvas.getWidth() / 2 - 50,
      top: options?.top ?? this.canvas.getHeight() / 2 - 15,
      fontSize: options?.fontSize || this.fontSize,
      fontFamily: this.fontFamily,
      fill: options?.color || this.textColor,
      editable: true,
      selectable: true,
      cornerColor: '#4a90d9',
      cornerStyle: 'circle',
      cornerSize: 10,
      transparentCorners: false,
      borderColor: '#4a90d9',
      hasRotatingPoint: true,
      padding: 5,
    });

    (text as any)._rpAnnotation = true;
    (text as any)._rpType = 'text';

    this.canvas.add(text);
    this.clampTextInsideImage(text);
    this.canvas.setActiveObject(text);
    this.canvas.renderAll();

    // Enter editing mode immediately
    this.beginEditing(text);

    return text;
  }

  /**
   * Set text color (for new text)
   */
  setTextColor(color: string): void {
    this.textColor = color;

    // Update currently selected text object if any
    const active = this.canvas.getActiveObject();
    if (active && active.type === 'i-text') {
      (active as fabric.IText).set('fill', color);
      this.canvas.renderAll();
    }
  }

  /**
   * Set font size (for new text)
   */
  setFontSize(size: number): void {
    this.fontSize = Math.max(8, Math.min(200, size));

    const active = this.canvas.getActiveObject();
    if (active && active.type === 'i-text') {
      (active as fabric.IText).set('fontSize', this.fontSize);
      this.canvas.renderAll();
    }
  }

  getTextColor(): string {
    return this.textColor;
  }

  getFontSize(): number {
    return this.fontSize;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  setPlacementBoundsProvider(
    provider: (() => { left: number; top: number; right: number; bottom: number } | null) | null,
  ): void {
    this.boundsProvider = provider;
  }

  private isPointInsideImage(x: number, y: number): boolean {
    const b = this.boundsProvider?.();
    if (!b) return true;
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }

  private clampTextInsideImage(text: fabric.IText): void {
    const b = this.boundsProvider?.();
    if (!b) return;
    const r = text.getBoundingRect(true, true);
    let dx = 0;
    let dy = 0;
    if (r.left < b.left) dx = b.left - r.left;
    if (r.left + r.width > b.right) dx = Math.min(dx, b.right - (r.left + r.width));
    if (r.top < b.top) dy = b.top - r.top;
    if (r.top + r.height > b.bottom) dy = Math.min(dy, b.bottom - (r.top + r.height));
    if (dx !== 0 || dy !== 0) {
      text.set({ left: (text.left || 0) + dx, top: (text.top || 0) + dy });
      text.setCoords();
    }
  }

  private handleCanvasClick = (opt: fabric.IEvent): void => {
    if (!this.pendingTextAdd) return;

    // In text mode, clicking an existing text annotation should re-enter edit mode.
    if (opt.target) {
      if (opt.target.type === 'i-text') {
        const textObj = opt.target as fabric.IText;
        this.canvas.setActiveObject(textObj);
        this.beginEditing(textObj);
        this.pendingTextAdd = false;
      }
      return;
    }

    const pointer = this.canvas.getPointer(opt.e);
    if (!this.isPointInsideImage(pointer.x, pointer.y)) return;
    this.addText({
      left: pointer.x,
      top: pointer.y,
    });

    // Single placement — user must click the text icon again to add another
    this.pendingTextAdd = false;
  };

  private beginEditing(text: fabric.IText): void {
    text.enterEditing();

    // Ensure keyboard focus lands in Fabric's hidden textarea, especially
    // after fullscreen transitions where browser focus can stay on toolbar buttons.
    const textarea = (text as any).hiddenTextarea as HTMLTextAreaElement | undefined;
    if (textarea && typeof textarea.focus === 'function') {
      setTimeout(() => textarea.focus(), 0);
    }
  }
}
