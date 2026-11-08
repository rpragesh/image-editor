import { Component, ElementRef, EventEmitter, Inject, Input, OnDestroy, Output, PLATFORM_ID, ViewChild, AfterViewInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RpImageEditor, RpEditorConfig, RpEditorResult } from '@rageshpikalmunde/rp-image-editor';

@Component({
  selector: 'rp-image-editor',
  template: `<div #editorContainer class="rp-image-editor-host" [style.width]="'100%'" [style.height]="'100%'" [style.display]="'flex'" [style.flexDirection]="'column'"></div>`,
  styles: [`:host { display: block; width: 100%; height: 100%; } .rp-image-editor-host { min-height: 300px; }`]
})
export class RpImageEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer', { static: true }) containerRef!: ElementRef<HTMLElement>;

  /** Image source — File, Blob, or URL string */
  @Input() image: File | Blob | string | null = null;

  /** Editor configuration */
  @Input() config: Partial<RpEditorConfig> = {};

  /** Emitted when user clicks Apply — contains the edited image result */
  @Output() imageEdited = new EventEmitter<RpEditorResult>();

  /** Emitted when user clicks Close/Cancel */
  @Output() editorClosed = new EventEmitter<void>();

  /** Emitted when an error occurs */
  @Output() editorError = new EventEmitter<Error>();

  private editor: RpImageEditor | null = null;

  /** False during server-side rendering, where there is no DOM/canvas. */
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (this.image) {
      this.initEditor();
    }
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }

  /**
   * Programmatically load an image (can be called after component init)
   */
  async loadImage(source: File | Blob | string): Promise<void> {
    this.image = source;
    await this.initEditor();
  }

  /**
   * Get the edited result programmatically
   */
  async getResult(): Promise<RpEditorResult | null> {
    try {
      return await this.editor?.getResult() ?? null;
    } catch (err) {
      this.editorError.emit(err as Error);
      return null;
    }
  }

  /**
   * Apply and emit result
   */
  async apply(): Promise<void> {
    const result = await this.getResult();
    if (result) {
      this.imageEdited.emit(result);
    }
  }

  /**
   * Close the editor
   */
  close(): void {
    this.destroyEditor();
    this.editorClosed.emit();
  }

  /**
   * Reset to original image
   */
  async reset(): Promise<void> {
    await this.editor?.reset();
  }

  private async initEditor(): Promise<void> {
    this.destroyEditor();

    if (!this.isBrowser || !this.image || !this.containerRef?.nativeElement) return;

    this.editor = new RpImageEditor(this.containerRef.nativeElement, this.config);

    this.editor.on('error', (err) => {
      this.editorError.emit(err);
    });

    try {
      await this.editor.loadImage(this.image);
    } catch (err) {
      this.editorError.emit(err as Error);
    }
  }

  private destroyEditor(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }
}
