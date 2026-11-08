# @rageshpikalmunde/rp-image-editor-angular

Angular wrapper for [`@rageshpikalmunde/rp-image-editor`](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor), a browser image editor and annotator (crop, rotate, draw, text, shapes, callouts, filters, undo/redo, native-resolution export).

[Live demo](https://rpragesh.github.io/image-editor/) · [Angular example on StackBlitz](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/angular) · [API reference](https://rpragesh.github.io/image-editor/api/) · [Full docs](https://github.com/rpragesh/image-editor#readme)

Requires **Angular 15 or newer**. Works with NgModules and standalone components, and with Ionic (optional).

## Install

```bash
npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-angular
```

**Angular 17+ with the default `application` builder:** add this to `architect.build.options` in `angular.json`. Fabric.js 5 has a Node-only code path that the esbuild builder otherwise tries to bundle; it never runs in the browser.

```json
"externalDependencies": ["jsdom", "canvas"]
```

## Modal: `RpImageEditorService`

```typescript
import { RpImageEditorService } from '@rageshpikalmunde/rp-image-editor-angular';

export class UploadComponent {
  constructor(private rpEditor: RpImageEditorService) {}

  async edit(file: File) {
    const result = await this.rpEditor.openEditor(file, {
      exportFormat: 'jpeg',
      theme: { headerTitle: 'Edit photo' },
    });
    if (result) {
      // result.file (upload via FormData), result.base64, result.blob
    }
  }
}
```

The service is `providedIn: 'root'`, so it needs no module import.

## Inline: `<rp-image-editor>`

```typescript
import { Component, ViewChild } from '@angular/core';
import { RpImageEditorComponent, RpImageEditorModule } from '@rageshpikalmunde/rp-image-editor-angular';

@Component({
  standalone: true,
  imports: [RpImageEditorModule], // or add RpImageEditorModule to your NgModule
  template: `
    <div style="height: 520px">
      <rp-image-editor [image]="file" [config]="{ exportFormat: 'png' }"
                       (imageEdited)="onEdited($event)" (editorError)="onError($event)"></rp-image-editor>
    </div>
    <button (click)="editor.apply()">Apply</button>
  `,
})
export class InlineEditorComponent {
  @ViewChild(RpImageEditorComponent) editor!: RpImageEditorComponent;
  file: File | string = 'assets/photo.jpg';
  onEdited(result: unknown) { /* ... */ }
  onError(error: Error) { console.error(error); }
}
```

Component API: inputs `image`, `config`; outputs `imageEdited`, `editorClosed`, `editorError`; methods `apply()`, `getResult()`, `loadImage()`, `reset()`, `close()`.

## Server-side rendering

`<rp-image-editor>` does nothing on the server and creates the editor in the browser. Call `openEditor()` from user actions such as clicks.

## License

MIT
