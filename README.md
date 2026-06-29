# @rageshpikalmunde/rp-image-editor

A lightweight, framework-agnostic image editor plugin built with Fabric.js.

**[Live Demo](https://rpragesh.github.io/image-editor/)** · [npm](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor) · [GitHub](https://github.com/rpragesh/image-editor)

## Features

- **Free crop** and aspect-ratio locked crop — annotations are preserved across crops
- **Zoom in/out** with pinch-to-zoom gesture support
- **Drag/pan** image inside the viewport
- **Rotate** left/right in 45° steps — annotations (drawings, text, shapes, callouts) are preserved and stay locked to the underlying pixels, with no cumulative drift past 360°. Fast path skips PNG re-encoding so large 10–15 MB+ images rotate quickly, and a loader overlay is shown while heavy renders are in progress.
- **Freehand draw** with configurable brush color & width
- **Add text** with inline editing, color, and font size
- **Predefined shapes** — Circle (proportion-locked), Ellipse (independent w/h), Square (proportion-locked), and Arrow (with editable start/end endpoints). All shapes are draggable, resizable, undo/redo-able, and erasable.
- **Callout annotations** — editable label box with draggable tail pointer, min-resize clamping, text constraints (max 40 chars, auto word-wrap), mobile double-tap editing, and delete button
- **Eraser** tool for removing annotations
- **Undo/Redo** with configurable stack depth
- **Reset** to original image
- **Native-resolution export** — output preserves the source image's intrinsic resolution; annotations stay sharp (toggle via `exportAtNativeResolution`)
- **HEIC support** — auto-converts iPhone HEIC to JPEG
- **EXIF orientation** — auto-corrects rotated photos
- **Smart resolution** — auto-downscales on iOS to stay within Safari canvas limits
- **Touch gestures** — pinch zoom, drag, tap on mobile
- **Theming** — fully customizable colors for header, footer, buttons, toolbar. Auto-contrast: when you customize a background without setting its paired text/icon color, a readable foreground is derived from the background's luminance, so dark themes never end up with invisible icons.
- **Output** — Base64, Blob, and File object

## Packages

| Package | Description |
|---|---|
| `@rageshpikalmunde/rp-image-editor` | Core engine (vanilla TS + Fabric.js) |
| `@rageshpikalmunde/rp-image-editor-angular` | Angular wrapper (Ionic modal) |
| `@rageshpikalmunde/rp-image-editor-react` | React wrapper (Ionic modal) |

## Quick Start (Angular)

```bash
npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-angular
```

```typescript
// app.module.ts
import { RpImageEditorModule } from '@rageshpikalmunde/rp-image-editor-angular';

@NgModule({
  imports: [RpImageEditorModule]
})
export class AppModule {}
```

```typescript
// your-component.ts
import { RpImageEditorService } from '@rageshpikalmunde/rp-image-editor-angular';

constructor(private rpEditor: RpImageEditorService) {}

async editImage(file: File) {
  const result = await this.rpEditor.openEditor(file, {
    theme: {
      applyButtonBackground: '#4a90d9',
      headerTitle: 'Edit Photo'
    }
  });
  if (result) {
    console.log(result.file);   // File object — upload to server
    console.log(result.base64); // data:image/png;base64,...
  }
}
```

## Quick Start (React)

```bash
npm install @rageshpikalmunde/rp-image-editor
```

```tsx
import { openEditorModal } from '@rageshpikalmunde/rp-image-editor';

function ImageUploader() {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await openEditorModal({
      image: file,
      config: {
        exportFormat: 'jpeg',
        exportQuality: 0.92,
        theme: {
          headerTitle: 'Edit Photo',
          applyButtonBackground: '#4a90d9',
        },
      },
    });

    if (result) {
      console.log(result.file);   // File object — upload via FormData
      console.log(result.base64); // data:image/jpeg;base64,...
    }
  };

  return <input type="file" accept="image/*" onChange={handleFile} />;
}
```

## License

MIT
