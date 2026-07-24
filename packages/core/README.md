# @rageshpikalmunde/rp-image-editor

[![npm version](https://img.shields.io/npm/v/%40rageshpikalmunde%2Frp-image-editor.svg)](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor)
[![npm downloads](https://img.shields.io/npm/dt/%40rageshpikalmunde%2Frp-image-editor.svg)](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor)
[![license](https://img.shields.io/npm/l/%40rageshpikalmunde%2Frp-image-editor.svg)](https://github.com/rpragesh/image-editor/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40rageshpikalmunde%2Frp-image-editor)](https://bundlephobia.com/package/@rageshpikalmunde/rp-image-editor)

> A lightweight, framework-agnostic **JavaScript image editor** built on [Fabric.js](http://fabricjs.com/). Crop, zoom, rotate, draw, add text, **shapes (circle / ellipse / square / arrow)**, callout annotations, erase, undo/redo — all in a beautiful modal UI with grouped toolbar. **Always-on drag with a translucent ghost preview** keeps the image visible while panning and zooming. **Annotations are preserved across both crop and rotate** (no drift past 360°), exports run at the image's native resolution by default, and themes auto-contrast so customized backgrounds always get a readable foreground. Works with **Angular**, **React**, **Vue**, **Ionic**, **Capacitor**, and plain JavaScript.

### 🚀 **[▶ Try the Live Demo →](https://rpragesh.github.io/image-editor/)**

> One click — the editor opens with a sample image already loaded. No signup, no upload. Draw, crop, rotate, add callouts, apply filters — try every tool right in your browser.

![rp-image-editor screenshot](https://raw.githubusercontent.com/rpragesh/image-editor/main/demo/screenshot.png)

## Features

| Feature | Description |
|---|---|
| ✂️ **Crop** | Free crop and aspect-ratio locked crop. Initial ratio chip matches the actual rectangle; switching ratios (e.g. 4:3 ↔ 16:9) refits into the same 80% image-bounds envelope so sizes stay consistent. Annotations are preserved across crops. |
| 🔍 **Zoom** | Zoom in/out with pinch-to-zoom gesture support |
| 🖐️ **Pan/Drag** | Always-on drag — no need to enable a tool. A translucent **ghost preview** of the image sits behind the canvas so the picture is never hidden while panning past its edges or zooming out. |
| 🔄 **Rotate** | Rotate left/right by 45° steps. Annotations are preserved across rotations and stay locked to the underlying pixels (no drift past 360°). Fast path skips PNG re-encoding so large 10–15 MB+ images rotate quickly; a loader overlay is shown during heavy renders. |
| ✏️ **Freehand Draw** | Configurable brush color & width |
| 🔤 **Add Text** | Inline editing with color and font size |
| ⭕ **Shapes** | Circle, Ellipse, Square and Arrow primitives with resize handles. Circle/Square stay proportional, Ellipse resizes freely, Arrow has draggable start/end endpoints |
| 💬 **Callout** | Editable label with draggable tail, min-resize clamping, text constraints (40 chars, word-wrap), mobile double-tap support. **Live color update**: picking a new color from the palette recolors the currently selected callout — same behaviour as shape/text/draw tools. |
| 🗑️ **Delete** | Delete selected callout/annotation via toolbar trash button |
| 🧹 **Eraser** | Remove annotations without affecting the image |
| ↩️ **Undo/Redo** | Configurable stack depth (default: 20) |
| 🔁 **Reset** | Reset to original image |
| 🎯 **Native-resolution export** | Output preserves the source image's intrinsic resolution; annotations stay sharp |
| 🎛️ **Grouped Toolbar** | Compact toolbar with flyout menus (Zoom, Transform, Annotate, Shapes) |
| 🚫 **Disable Features** | Hide individual tools or groups via `disabledFeatures` config |
| 📱 **HEIC Support** | Auto-converts iPhone HEIC photos to JPEG |
| 📐 **EXIF Orientation** | Auto-corrects rotated photos |
| ⚡ **Smart Resolution** | Auto-downscales on iOS to stay within Safari canvas limits |
| 👆 **Touch Gestures** | Pinch zoom, drag, tap on mobile |
| 🎨 **Theming** | Fully customizable colors for header, footer, buttons, toolbar. Auto-contrast: customized backgrounds without an explicit text/icon color get a readable foreground derived from luminance. |
| 🌐 **i18n (15 languages)** | Bundled translations for `da, de, en, es, fr, it, ko, nl, pl, pt, sv, th, tr, vi, zh` selectable via `language`. `sp` aliases to `es`; regional variants (`de-DE`, `pt_BR`, `zh-CN`, …) fold to the primary tag. |
| 🏷️ **Label overrides** | `labels` (deep-partial `LocalePack`) lets you rebrand individual strings or add languages beyond the built-in set. |
| 🎚️ **Filter presets config** | Whitelist / reorder the built-in filter tiles via `filterPresets`, or rename them via `filterPresetLabels`. |
| 💬 **Callout defaults config** | Override the initial `text`, `color`, `textColor`, `fontSize`, `maxChars`, and `lineBreakAt` for new callouts. |
| 📝 **Empty-state copy** | Customize the drop-zone title/subtitle via `strings.emptyStateTitle` / `strings.emptyStateSubtitle` (empty string hides the subtitle). |
| 📦 **Output** | Base64, Blob, and File object |

## Installation

```bash
npm install @rageshpikalmunde/rp-image-editor
```

## Quick Start

### Vanilla JavaScript / TypeScript

```typescript
import { openEditorModal } from '@rageshpikalmunde/rp-image-editor';

const fileInput = document.querySelector<HTMLInputElement>('#fileInput');

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
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
    console.log(result.blob);   // Blob
  }
});
```

### Angular / Ionic

```typescript
import { openEditorModal } from '@rageshpikalmunde/rp-image-editor';

// Or use the ImageEditorService wrapper for centralized config:
// import { ImageEditorService } from './services/image-editor.service';

async onFileSelected(file: File) {
  const result = await openEditorModal({
    image: file,
    config: { exportFormat: 'jpeg', exportQuality: 0.92 },
  });

  if (result) {
    // Upload result.file to your backend
  }
}
```

### React

```tsx
import { openEditorModal } from '@rageshpikalmunde/rp-image-editor';

function ImageUploader() {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await openEditorModal({
      image: file,
      config: { exportFormat: 'jpeg' },
    });

    if (result) {
      // Use result.file, result.base64, or result.blob
    }
  };

  return <input type="file" accept="image/*" onChange={handleFile} />;
}
```

## Programmatic API (Advanced)

```typescript
import { RpImageEditor } from '@rageshpikalmunde/rp-image-editor';

const container = document.getElementById('editor-container');
const editor = new RpImageEditor(container, {
  exportFormat: 'png',
  maxUndoSteps: 30,
  defaultBrushColor: '#ff0000',
  showToolbar: true,
});

await editor.loadImage(file);

// Control the editor programmatically
editor.setMode('draw');
editor.zoomIn();
editor.rotate(90);

// Export
const result = await editor.getResult();
console.log(result.file);

// Clean up
editor.destroy();
```

## Configuration

```typescript
interface RpEditorConfig {
  maxResolution?: number | null;    // Max image resolution (auto-detect per platform)
  cropAspectRatios?: CropAspectRatio[];
  exportFormat?: 'png' | 'jpeg';   // Default: 'jpeg'
  exportQuality?: number;          // 0.0–1.0, Default: 0.92
  exportPixelRatio?: number;       // 1 = standard, 2 = retina. Default: 1
  exportAtNativeResolution?: boolean; // Render export at the source image's native resolution. Default: true
  maxUndoSteps?: number;           // Default: 20
  defaultBrushColor?: string;      // Default: '#ff0000'
  defaultBrushWidth?: number;      // Default: 3
  defaultTextColor?: string;       // Default: '#ff0000'
  defaultTextFontSize?: number;    // Default: 24
  defaultShapeColor?: string;      // Default: matches defaultBrushColor
  defaultShapeStrokeWidth?: number; // Default: 3
  colorPalette?: string[];
  showToolbar?: boolean;           // Default: true
  disabledFeatures?: string[];     // Default: [] — see below
  filterPresets?: ImageFilterPreset[];                    // Whitelist / order the filter tiles
  filterPresetLabels?: Partial<Record<ImageFilterPreset, string>>;  // Rename individual tiles
  calloutDefaults?: {              // Defaults for newly-placed callouts
    text?: string;                 // Default: 'Label' (localised by `language`)
    color?: string;                // Default: matches defaultBrushColor
    textColor?: string;            // Default: '#ffffff'
    fontSize?: number;             // Default: 20
    maxChars?: number;             // Default: 40
    lineBreakAt?: number;          // Default: 15
  };
  strings?: {                      // Empty-state copy
    emptyStateTitle?: string;      // Default: 'Drop an image or click to upload'
    emptyStateSubtitle?: string;   // Default: 'Supported: PNG, JPEG, HEIC' (pass '' to hide)
  };
  theme?: RpEditorTheme;
  locale?: string;
  language?: LanguageCode;         // Two-letter code — see "Internationalization" below
  labels?: LocalePackOverrides;    // Deep-partial per-key overrides on top of the language pack
}
```

## Internationalization

Swap every user-facing string in the editor shell to any of 15 bundled languages with a single config key:

```typescript
await openEditorModal({
  image: file,
  config: { language: 'de' },   // header, rails, props panel, callouts … all German
});
```

**Supported codes:** `da, de, en, es, fr, it, ko, nl, pl, pt, sv, th, tr, vi, zh`

- `sp` is accepted as a convenience alias for `es`.
- Regional variants (`de-DE`, `pt_BR`, `zh-CN`, …) are folded to their primary tag.
- Unknown or missing codes fall back to English.

### Per-key overrides (`labels`)

`config.labels` accepts any subset of `LocalePack` keys and layers them on top of the resolved language pack. Use it to rebrand individual strings, or to provide a translation for a language that isn't in the built-in set — missing keys fall through to English.

```typescript
await openEditorModal({
  image: file,
  config: {
    language: 'en',
    labels: {
      tool: { callout: 'Annotation' },
      props: {
        title: { callout: 'Annotation' },
        deleteSelected: 'Remove',
      },
    },
  },
});
```

**Precedence** (highest wins):

1. Explicit fields on `theme`, `strings`, `filterPresetLabels`, `calloutDefaults`
2. `config.labels` per-key overrides
3. Language pack from `config.language`
4. English fallback pack

**Public helpers** (rarely needed — the editor calls these internally):

```typescript
import { getLocalePack, resolveLanguage } from '@rageshpikalmunde/rp-image-editor';
import type { LanguageCode, LocalePack, LocalePackOverrides } from '@rageshpikalmunde/rp-image-editor';

resolveLanguage('pt-BR');   // → 'pt'
getLocalePack('de');        // → the full German LocalePack
```

## Disabling Features

Hide individual tools or entire groups from the toolbar:

```typescript
const result = await openEditorModal({
  image: file,
  config: {
    // Hide individual tools
    disabledFeatures: ['eraser', 'reset'],

    // Or hide entire groups
    // disabledFeatures: ['zoom', 'transform'],
  },
});
```

**Individual tool names:** `move`, `crop`, `zoomIn`, `zoomOut`, `rotateLeft`, `rotateRight`, `draw`, `text`, `callout`, `eraser`, `filters`, `adjust`, `shape-circle`, `shape-ellipse`, `shape-square`, `shape-rectangle`, `shape-arrow`, `shape-polyline`, `undo`, `redo`, `reset`

**Group names** (disables all children): `zoom` (zoomIn + zoomOut), `transform` (rotateLeft + rotateRight), `annotate` (draw + text + callout + eraser), `shapes` (shape-circle + shape-ellipse + shape-square + shape-rectangle + shape-arrow + shape-polyline)

**Common recipes:**

```typescript
// Hide the Filters menu entirely
disabledFeatures: ['filters']

// Hide both Filters and Adjust tiles (no photo effects at all)
disabledFeatures: ['filters', 'adjust']

// Hide the whole Annotate group (draw + text + callout + eraser)
disabledFeatures: ['annotate']
```

## Toolbar Layout

The toolbar is organized into compact items with flyout menus:

| Button | Type | Contains |
|---|---|---|
| **Move** | Standalone | Pan / drag mode |
| **Crop** | Standalone | Free & aspect-ratio crop |
| **Zoom ▾** | Flyout | Zoom In, Zoom Out |
| **Transform ▾** | Flyout | Rotate Left, Rotate Right |
| **Annotate ▾** | Flyout | Draw, Text, Callout, Eraser |
| **Shapes ▾** | Flyout | Circle, Ellipse, Square, Arrow |
| **Undo** | Standalone | Undo last action |
| **Redo** | Standalone | Redo last undone action |
| **Reset** | Standalone | Reset to original image |

## Theming

All theme tokens are optional. When you customize a background (`headerBackground`,
`toolbarBackground`, `toolbarActiveBackground`, or `footerBackground`) but do **not**
set its paired foreground (`headerTextColor`, `toolbarIconColor`,
`toolbarActiveTextColor`, `cancelButtonTextColor`), the editor will automatically
derive a readable foreground from the background's WCAG relative luminance — dark
backgrounds get white text/icons, light backgrounds get dark. Explicit overrides
always win.

Use `toolbarActiveBackground` to control the highlight color of the currently
selected toolbar tool. Pick a color with strong contrast against
`toolbarBackground` so the active tool stands out clearly to the user.

```typescript
const result = await openEditorModal({
  image: file,
  config: {
    theme: {
      headerBackground: '#1a1a2e',
      headerTextColor: '#ffffff',
      headerTitle: 'Edit Image',
      editorBackground: '#000000',
      toolbarBackground: '#1a1a2e',
      toolbarIconColor: '#cccccc',
      // Highlight color for the currently selected toolbar tool.
      // Choose a color with strong contrast against `toolbarBackground`.
      toolbarActiveBackground: '#4a90d9',
      toolbarActiveTextColor: '#ffffff',
      footerBackground: '#1a1a2e',
      applyButtonBackground: '#4a90d9',
      applyButtonTextColor: '#ffffff',
      cancelButtonBackground: 'transparent',
      cancelButtonTextColor: '#ffffff',
      modalBorderRadius: '12px',
      buttonBorderRadius: '6px',
    },
  },
});
```

> **Note:** The older `toolbarActiveIconColor` prop is still supported as an
> alias for `toolbarActiveBackground` for backward compatibility, but new code
> should prefer the semantically-named `toolbarActiveBackground` /
> `toolbarActiveTextColor` pair.

## Browser Support

| Browser | Version |
|---|---|
| Chrome | 60+ |
| Firefox | 60+ |
| Safari | 12+ |
| Edge | 79+ |
| iOS Safari | 12+ |
| Android Chrome | 60+ |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/rpragesh/image-editor).

## Upgrading from 1.3.0

**Nothing in your existing code has to change.** 1.4.0 is 100% backward-compatible — every new config key is optional and every default value matches 1.3.0. If you install 1.4.0 and touch nothing, you get the same English UI, the same toolbar, the same filter tiles in the same order, and the same callout defaults you had in 1.3.0.

### 1. Bump the version

```bash
npm install @rageshpikalmunde/rp-image-editor@^1.4.0
# and if you use the framework wrappers (they peer-depend on core ^1.4.0):
npm install @rageshpikalmunde/rp-image-editor-react@^1.4.0
npm install @rageshpikalmunde/rp-image-editor-angular@^1.4.0
```

### 2. Opt into the new features (all optional)

Add any subset of the new keys to your existing `config` object. You do **not** need to remove or restructure anything you already pass:

```typescript
await openEditorModal({
  image: file,
  config: {
    // ...everything you already had in 1.3.0 still works, unchanged...

    // Localize the UI to any of 15 bundled languages
    language: 'de',

    // Per-key label overrides (rebrand, or translate to a language not bundled)
    labels: { tool: { callout: 'Annotation' } },

    // Whitelist / reorder the filter tiles, and rename them
    filterPresets: ['none', 'grayscale', 'vintage'],
    filterPresetLabels: { grayscale: 'B&W' },

    // Defaults for newly-placed callouts
    calloutDefaults: { text: 'Note', fontSize: 18, maxChars: 60 },

    // Empty-state copy (drop-zone title/subtitle). Pass '' to hide the subtitle.
    strings: {
      emptyStateTitle: 'Drop a photo here',
      emptyStateSubtitle: '',
    },

    // Header subtitle (below the header title). Pass '' to hide the row.
    theme: { headerSubtitle: 'Edit and annotate' },
  },
});
```

### Hiding the Filters menu

Use `disabledFeatures` (available since 1.0.3 — see [Disabling Features](#disabling-features) above) to hide the Filters tile:

```typescript
await openEditorModal({
  image: file,
  config: {
    disabledFeatures: ['filters'],           // hide Filters only
    // disabledFeatures: ['filters', 'adjust'], // hide Filters + Adjust
  },
});
```

### Rolling back

Every 1.4.0 change is additive — no data, export, or storage format changed — so you can downgrade at any time with no code changes:

```bash
npm install @rageshpikalmunde/rp-image-editor@1.3.0
npm install @rageshpikalmunde/rp-image-editor-react@1.3.0
npm install @rageshpikalmunde/rp-image-editor-angular@1.3.0
```

## License

[MIT](./LICENSE) © [Ragesh Pikalmunde](https://github.com/rpragesh)
