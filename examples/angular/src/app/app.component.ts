import { Component, ViewChild } from '@angular/core';
import {
  RpImageEditorComponent,
  RpImageEditorModule,
  RpImageEditorService,
} from '@rageshpikalmunde/rp-image-editor-angular';
import type { RpEditorConfig, RpEditorResult } from '@rageshpikalmunde/rp-image-editor';

const SAMPLE = 'https://rpragesh.github.io/image-editor/sample.png';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RpImageEditorModule],
  template: `
    <main>
      <h1>rp-image-editor · Angular</h1>

      <h2>1. Modal (RpImageEditorService)</h2>
      <p>Pick a photo, or use the sample, to open the editor full-screen.</p>
      <div class="actions">
        <label class="btn">
          Choose image
          <input type="file" accept="image/*,.heic,.heif" (change)="onFile($event)" hidden />
        </label>
        <button class="btn secondary" (click)="openModal(sample)">Edit the sample</button>
      </div>

      <h2>2. Inline (&lt;rp-image-editor&gt;)</h2>
      @if (inlineImage) {
        <div class="inline-host">
          <rp-image-editor
            [image]="inlineImage"
            [config]="config"
            (imageEdited)="onResult($event)"
            (editorError)="onError($event)"
          />
        </div>
        <div class="actions">
          <button class="btn" (click)="inlineEditor.apply()">Apply</button>
          <button class="btn secondary" (click)="inlineImage = null">Close</button>
        </div>
      } @else {
        <button class="btn secondary" (click)="inlineImage = sample">Show inline editor</button>
      }

      @if (result) {
        <section>
          <h2>Result · {{ result.width }} × {{ result.height }}</h2>
          <img [src]="result.base64" alt="Edited image" />
        </section>
      }
    </main>
  `,
  styles: [`
    main { max-width: 860px; margin: 40px auto; padding: 0 16px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
    .btn { padding: 10px 16px; border-radius: 8px; border: 0; background: #4a90d9; color: #fff; font: inherit; cursor: pointer; }
    .btn.secondary { background: #e3e7ee; color: #1d2330; }
    .inline-host { height: 520px; border-radius: 8px; overflow: hidden; }
    img { max-width: 100%; border-radius: 8px; box-shadow: 0 2px 12px rgb(0 0 0 / 0.12); }
  `],
})
export class AppComponent {
  @ViewChild(RpImageEditorComponent) inlineEditor!: RpImageEditorComponent;

  readonly sample = SAMPLE;
  readonly config: Partial<RpEditorConfig> = {
    exportFormat: 'jpeg',
    exportQuality: 0.92,
    theme: { headerTitle: 'Edit photo' },
  };

  inlineImage: string | null = null;
  result: RpEditorResult | null = null;

  constructor(private rpEditor: RpImageEditorService) {}

  onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.openModal(file);
  }

  async openModal(image: File | string): Promise<void> {
    const result = await this.rpEditor.openEditor(image, this.config);
    if (result) this.onResult(result);
  }

  onResult(result: RpEditorResult): void {
    this.result = result;
  }

  onError(error: Error): void {
    console.error('Editor error', error);
  }
}
