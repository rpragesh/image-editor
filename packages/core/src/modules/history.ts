/**
 * History Module — undo/redo with JSON state snapshots
 *
 * Each entry stores the canvas JSON plus an opaque `extra` record that
 * the owner supplies through `HistoryHooks`. With hooks installed, the
 * base image (`_rpBaseImage`) is left out of the canvas JSON: Fabric
 * would otherwise serialize it as a full data URL (and PNG-encode it
 * on every save once the base image is a <canvas>, e.g. after rotate).
 * The owner records what it needs to rebuild the base image in `extra`
 * and re-installs it in `restore()`.
 */
import { fabric } from 'fabric';

export interface HistoryHooks {
  /** Owner state saved with every entry (must be JSON-compatible). */
  capture(): unknown;
  /**
   * Re-apply `extra` after the canvas JSON has been loaded. Runs while
   * the module is still restoring, so `saveState()` calls are ignored.
   */
  restore(extra: unknown): Promise<void> | void;
  /** Called with every live entry's `extra` after the stacks change. */
  prune?(liveExtras: unknown[]): void;
}

interface HistoryEntry {
  canvas: string;
  extra: unknown;
  /** JSON of `extra`, kept for cheap duplicate detection. */
  extraKey: string;
}

const CUSTOM_PROPS = [
  '_rpAnnotation',
  '_rpType',
  '_rpBaseImage',
  '_rpShapeType',
  'calloutId',
  'calloutRole',
  '_rpFullText',
  'x1',
  'y1',
  'x2',
  'y2',
  'arrowheadSize',
];

export class HistoryModule {
  private canvas: fabric.Canvas;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxSteps: number;
  private hooks: HistoryHooks | null;
  private isRestoring = false;
  private onChangeCallback: ((state: { canUndo: boolean; canRedo: boolean }) => void) | null = null;

  constructor(canvas: fabric.Canvas, maxSteps: number = 20, hooks?: HistoryHooks) {
    this.canvas = canvas;
    this.maxSteps = maxSteps;
    this.hooks = hooks ?? null;
  }

  /**
   * Save current canvas state to the undo stack
   */
  saveState(): void {
    if (this.isRestoring) return;

    const entry = this.captureEntry();

    // Don't save duplicate states
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.canvas === entry.canvas && last.extraKey === entry.extraKey) {
      return;
    }

    this.undoStack.push(entry);

    // Trim stack if exceeding max
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];

    this.notifyChange();
    this.prune();
  }

  /**
   * Re-capture the newest entry after a pure layout change (the canvas was
   * re-fitted, so every display coordinate moved). The logical state is the
   * same, so this keeps the next save from looking like a change and
   * leaving an undo step that does nothing. Callers must only use this
   * when no edit is in progress.
   */
  refreshTop(): void {
    if (this.isRestoring || this.undoStack.length === 0) return;
    this.undoStack[this.undoStack.length - 1] = this.captureEntry();
    this.prune();
  }

  /** Number of annotation objects in the newest entry. */
  topAnnotationCount(): number {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top) return 0;
    try {
      return (JSON.parse(top.canvas).objects || []).filter((o: any) => o._rpAnnotation).length;
    } catch {
      return -1;
    }
  }

  /**
   * Initialize history with the first state (original image)
   */
  initialize(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.saveState();
  }

  /**
   * Undo the last action
   */
  async undo(): Promise<void> {
    if (this.undoStack.length <= 1) return; // Keep at least the initial state

    const current = this.undoStack.pop()!;
    this.redoStack.push(current);

    const previous = this.undoStack[this.undoStack.length - 1];
    await this.restoreState(previous);

    this.notifyChange();
  }

  /**
   * Redo the last undone action
   */
  async redo(): Promise<void> {
    if (this.redoStack.length === 0) return;

    const state = this.redoStack.pop()!;
    this.undoStack.push(state);

    await this.restoreState(state);

    this.notifyChange();
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Reset to the original state (first in the undo stack)
   */
  async reset(): Promise<void> {
    if (this.undoStack.length === 0) return;

    // Move current state to redo so user can redo if they want
    const originalState = this.undoStack[0];
    this.redoStack = [...this.undoStack.slice(1), ...this.redoStack];
    this.undoStack = [originalState];

    await this.restoreState(originalState);
    this.notifyChange();
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
    this.prune();
  }

  /**
   * Set a callback for state changes
   */
  onChange(callback: (state: { canUndo: boolean; canRedo: boolean }) => void): void {
    this.onChangeCallback = callback;
  }

  private captureEntry(): HistoryEntry {
    // With hooks, the owner rebuilds the base image from `extra`, so keep
    // it out of the JSON. excludeFromExport is honoured by canvas.toJSON.
    const excluded: Array<{ obj: any; prev: boolean | undefined }> = [];
    if (this.hooks) {
      for (const obj of this.canvas.getObjects() as any[]) {
        if (obj._rpBaseImage) {
          excluded.push({ obj, prev: obj.excludeFromExport });
          obj.excludeFromExport = true;
        }
      }
    }
    let canvas: string;
    try {
      canvas = JSON.stringify(this.canvas.toJSON(CUSTOM_PROPS));
    } finally {
      for (const { obj, prev } of excluded) obj.excludeFromExport = prev;
    }
    const extra = this.hooks ? this.hooks.capture() : null;
    return { canvas, extra, extraKey: JSON.stringify(extra) };
  }

  private async restoreState(entry: HistoryEntry): Promise<void> {
    this.isRestoring = true;
    try {
      await new Promise<void>((resolve) => {
        this.canvas.loadFromJSON(entry.canvas, () => resolve());
      });
      if (this.hooks) await this.hooks.restore(entry.extra);
    } finally {
      // Ensure background stays transparent (never bake theme color into canvas)
      this.canvas.backgroundColor = 'transparent';
      this.canvas.renderAll();
      this.isRestoring = false;
    }
  }

  private prune(): void {
    if (!this.hooks?.prune) return;
    this.hooks.prune([...this.undoStack, ...this.redoStack].map((e) => e.extra));
  }

  private notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
      });
    }
  }
}
