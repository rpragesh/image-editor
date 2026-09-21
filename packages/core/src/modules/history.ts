/**
 * History Module — undo/redo with JSON state snapshots
 */
import { fabric } from 'fabric';

export class HistoryModule {
  private canvas: fabric.Canvas;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxSteps: number;
  private isRestoring = false;
  private onChangeCallback: ((state: { canUndo: boolean; canRedo: boolean }) => void) | null = null;

  constructor(canvas: fabric.Canvas, maxSteps: number = 20) {
    this.canvas = canvas;
    this.maxSteps = maxSteps;
  }

  /**
   * Save current canvas state to the undo stack
   */
  saveState(): void {
    if (this.isRestoring) return;

    const json = JSON.stringify(this.canvas.toJSON([
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
    ]));

    // Don't save duplicate states
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === json) {
      return;
    }

    this.undoStack.push(json);

    // Trim stack if exceeding max
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];

    this.notifyChange();
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
  }

  /**
   * Set a callback for state changes
   */
  onChange(callback: (state: { canUndo: boolean; canRedo: boolean }) => void): void {
    this.onChangeCallback = callback;
  }

  private async restoreState(stateJson: string): Promise<void> {
    this.isRestoring = true;
    return new Promise<void>((resolve) => {
      this.canvas.loadFromJSON(stateJson, () => {
        // Ensure background stays transparent (never bake theme color into canvas)
        this.canvas.backgroundColor = 'transparent';
        this.canvas.renderAll();
        this.isRestoring = false;
        resolve();
      });
    });
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
