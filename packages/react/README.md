# @rageshpikalmunde/rp-image-editor-react

React image editor and annotation component for [`@rageshpikalmunde/rp-image-editor`](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor): crop, rotate, draw, text, arrows, shapes, callouts, filters and multi-image editing. Accessible (WCAG 2.2 AA), mobile-ready, TypeScript.

[Live demo](https://rpragesh.github.io/image-editor/) · [React guide](https://rpragesh.github.io/image-editor/react-image-editor/) · [React example on StackBlitz](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/react) · [API reference](https://rpragesh.github.io/image-editor/api/) · [Full docs](https://github.com/rpragesh/image-editor#readme)

[![rp-image-editor: multi-image editing, crop, arrows and filters](https://rpragesh.github.io/image-editor/demo.gif)](https://rpragesh.github.io/image-editor/)

## Install

```bash
npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-react
```

Works with React 17 and newer (Vite, CRA, Next.js, Ionic React).

## Open the editor as a modal

```tsx
import { useRpImageEditor } from '@rageshpikalmunde/rp-image-editor-react';

export function PhotoUpload() {
  const { openEditor } = useRpImageEditor();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await openEditor(file, { exportFormat: 'jpeg' });
    if (result) upload(result.file); // also result.blob and result.base64
  }

  return <input type="file" accept="image/*" onChange={onFile} />;
}
```

`openEditor` resolves with the edited image when the user clicks Apply, or `null` if they close the editor.

## Edit several images at once

```tsx
const { openMultiEditor } = useRpImageEditor();

const results = await openMultiEditor(files, { exportFormat: 'jpeg' });
// [{ index, edited, result }] for every image, or null if closed
```

A thumbnail strip switches between images, each keeps its own undo history, and Close asks before discarding edits.

## Inline editor

```tsx
import { RpImageEditorComponent } from '@rageshpikalmunde/rp-image-editor-react';

<RpImageEditorComponent
  image={file}
  config={{ language: 'de' }}
  onImageEdited={(result) => upload(result.file)}
  style={{ height: 600 }}
/>
```

Passing `onImageEdited` shows the editor's Apply button.

## Next.js

The editor needs the browser (DOM and canvas). Call `openEditor` from an event handler, or load `RpImageEditorComponent` with `next/dynamic` and `ssr: false`.

## Configuration

Every option of the core package works here: themes, 15 languages, which tools to show, crop ratios, filter presets, export format and quality. See the [configuration docs](https://github.com/rpragesh/image-editor/blob/main/packages/core/README.md#configuration).

## License

MIT © Ragesh Pikalmunde
