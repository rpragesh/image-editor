# @rageshpikalmunde/rp-image-editor

[![npm version](https://img.shields.io/npm/v/%40rageshpikalmunde%2Frp-image-editor.svg)](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor)
[![npm downloads](https://img.shields.io/npm/dt/%40rageshpikalmunde%2Frp-image-editor.svg)](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor)
[![license](https://img.shields.io/npm/l/%40rageshpikalmunde%2Frp-image-editor.svg)](https://github.com/rpragesh/image-editor/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40rageshpikalmunde%2Frp-image-editor)](https://bundlephobia.com/package/@rageshpikalmunde/rp-image-editor)

> An open-source **image editor and annotation tool for JavaScript, React and Angular**, built on [Fabric.js](http://fabricjs.com/). Crop, rotate, draw, add text, arrows, shapes and callouts, apply filters, and **edit several images at once**. Accessible (WCAG 2.2 AA), mobile-ready, 15 languages, and exports at the original resolution. Works with Angular, React, Vue, Ionic, Capacitor and plain JavaScript.
> Use it for photo editing, screenshot markup, document annotation and image upload flows, entirely in the browser.

### 🚀 **[▶ Try the Live Demo →](https://rpragesh.github.io/image-editor/)**

[![rp-image-editor: multi-image editing, crop, arrows and filters](https://rpragesh.github.io/image-editor/demo.gif)](https://rpragesh.github.io/image-editor/)

📚 [API reference](https://rpragesh.github.io/image-editor/api/) · Guides: [React image editor](https://rpragesh.github.io/image-editor/react-image-editor/) · [Angular image editor](https://rpragesh.github.io/image-editor/angular-image-editor/) · [Image annotation in JavaScript](https://rpragesh.github.io/image-editor/image-annotation/) · ⚡ Live examples on StackBlitz: [React](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/react) · [Angular](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/angular) · [Plain HTML (CDN)](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/vanilla-cdn)

> One click opens a live browser demo with a sample image already loaded. No signup, no upload. Draw, crop, rotate, add callouts, apply filters, and test export quality right in your browser.

## Features

| Feature | Description |
|---|---|
| ✂️ **Crop** | Free crop and aspect-ratio locked crop. Initial ratio chip matches the actual rectangle; switching ratios (e.g. 4:3 ↔ 16:9) refits into the same 80% image-bounds envelope so sizes stay consistent. Annotations are preserved across crops. |
| 🔍 **Zoom** | Zoom in (100%–500%) with buttons, wheel or pinch; 100% fits the image to the stage. Zoom only changes the view — Apply always exports the whole image |
| 🖐️ **Pan/Drag** | Always-on drag — no need to enable a tool. |
| 🔄 **Rotate** | Rotate left/right by 90° steps. Annotations are preserved across rotations and stay locked to the underlying pixels (no drift past 360°). Fast path skips PNG re-encoding so large 10–15 MB+ images rotate quickly; a loader overlay is shown during heavy renders. |
| ✏️ **Freehand Draw** | Configurable brush color & width |
| 🎨 **Unified Active Color** | One shared active color state across Draw, Text, Shapes, and Callout. Palette selection always reflects the true active color (including defaults). |
| 🔤 **Add Text** | Inline editing with color and font size |
| ⭕ **Shapes** | Circle, Ellipse, Square and Arrow primitives with resize handles. Circle/Square stay proportional, Ellipse resizes freely, Arrow has draggable start/end endpoints |
| 💬 **Callout** | Editable label with draggable tail, min-resize clamping, text constraints (40 chars, word-wrap), mobile double-tap support. **Live color update**: picking a new color from the palette recolors the currently selected callout — same behaviour as shape/text/draw tools. |
| 🧪 **Custom Color Sync** | Custom color picks are mirrored into the palette as a dynamic swatch and remain selected across tool switches. |
| 🗑️ **Delete** | Delete selected callout/annotation via toolbar trash button |
| 🧹 **Eraser** | Remove annotations without affecting the image |
| ↩️ **Undo/Redo** | Configurable stack depth (default: 20) |
| 🔁 **Reset** | Reset to original image |
| 🎯 **Native-resolution export** | Output preserves the source image's intrinsic resolution; annotations stay sharp |
| 🎛️ **Clean layout** | One tool rail and a settings panel that only appears when a tool has settings; on phones the tools move to a scrolling bottom bar |
| ♿ **Accessible** | Tested against WCAG 2.2 AA with axe-core: labelled controls, visible focus, focus kept inside the modal, keyboard shortcuts for crop, nudge and delete |
| 🖼️ **Multi-image editing** | `openMultiEditorModal` edits a batch with a thumbnail strip, per-image undo, and a discard prompt on Close. |
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
| 🧷 **Bounds-safe annotations** | Text, callouts, shapes, and draw strokes stay clipped/clamped to the visible image area, which keeps editing and exports clean even after zooming, panning, undo/redo, or fullscreen transitions. |
| 📦 **Output** | Base64, Blob, and File object |

## Installation

```bash
npm install @rageshpikalmunde/rp-image-editor
```

### Without a bundler (CDN / `<script>` tag)

A self-contained build (Fabric.js included, styles injected at runtime) exposes the global `RpImageEditor`:

```html
<!-- Optional: only needed to open HEIC/HEIF photos (~1.3 MB) -->
<script src="https://unpkg.com/heic2any@0.0.4/dist/heic2any.js"></script>

<script src="https://unpkg.com/@rageshpikalmunde/rp-image-editor@1/dist/browser/rp-image-editor.min.js"></script>
<script>
  document.querySelector('#file').addEventListener('change', async (e) => {
    const result = await RpImageEditor.openEditorModal({ image: e.target.files[0] });
    if (result) console.log(result.file); // upload via FormData
  });
</script>
```

The bundle is ~540 KB minified (~150 KB gzipped). It is also on jsDelivr (`https://cdn.jsdelivr.net/npm/@rageshpikalmunde/rp-image-editor@1/dist/browser/rp-image-editor.min.js`). Pin an exact version (e.g. `@1.6.0`) in production. Everything the npm package exports is available on the global, e.g. `new RpImageEditor.RpImageEditor(container, config)`.

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

### Editing several images

`openMultiEditorModal` opens a batch in one editor, with a thumbnail strip under the photo:

```typescript
import { openMultiEditorModal } from '@rageshpikalmunde/rp-image-editor';

const results = await openMultiEditorModal({
  images: Array.from(input.files),     // File | Blob | URL string
  config: { exportFormat: 'jpeg' },     // shared by every image
  startIndex: 0,                        // optional
});

if (results) {
  for (const { index, edited, result } of results) {
    if (edited) upload(result.file);    // or upload them all
  }
}
```

- Each image keeps its own edits and undo history while the user switches between them. Images load the first time they're opened.
- A dot marks edited images. Undoing every change clears it.
- **Apply** resolves with one entry per image, in order. Images the user didn't change are exported too, with `edited: false`. Images that fail to load are left out.
- **Close** resolves with `null`. If anything was edited, the user is asked "Discard changes to N images?" first.

In Angular use `RpImageEditorService.openMultiEditor(images, config)`; in React, `useRpImageEditor().openMultiEditor(images, config)`.

The header shows a `2/5` counter. If you run your own sequence of single-image modals instead, you can show the same counter by passing `currentImageIndex` and `totalImages` to `openEditorModal`. The values are clamped, so out-of-range inputs never produce an invalid counter.

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

## Live examples

Runnable projects in [`examples/`](https://github.com/rpragesh/image-editor/tree/main/examples). Each one shows the modal and the inline editor:

| Example | Open in StackBlitz |
|---|---|
| React + Vite (`useRpImageEditor`, `RpImageEditorComponent`) | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/react) |
| Angular 17 standalone (`RpImageEditorService`, `<rp-image-editor>`) | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/angular) |
| Plain HTML, no build step (CDN bundle) | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/vanilla-cdn) |

## Server-side rendering (SSR)

The editor needs a browser: it draws on a `<canvas>` and builds its UI in the DOM. **Importing the package on the server is safe**; only creating an editor is not. So create it, or open the modal, only in the browser:

- **React / Next.js**: `RpImageEditorComponent` creates the editor in `useEffect`, so it is safe to render on the server. Call `openEditor()` / `openEditorModal()` from event handlers, never during render. With the App Router, use the editor from a `'use client'` component. To keep Fabric.js out of the server bundle entirely, load it lazily: `const { openEditorModal } = await import('@rageshpikalmunde/rp-image-editor')` inside the handler, or `next/dynamic` with `{ ssr: false }` for the inline component.
- **Angular SSR** (`@angular/ssr` / Universal): `<rp-image-editor>` does nothing on the server and creates the editor once the page hydrates in the browser. Call `RpImageEditorService.openEditor()` from user actions such as clicks. If you construct `RpImageEditor` yourself, guard it with `isPlatformBrowser(platformId)` or `afterNextRender()`.
- **Nuxt / Vue SSR**: wrap the host element in `<ClientOnly>` and create the editor in `onMounted`.
- **SvelteKit / Astro**: create the editor in `onMount` / a `client:only` island.

## Bundler notes

- **Angular 17+ (`application` builder / esbuild)**: Fabric.js 5 contains a Node-only code path that the esbuild-based builder tries to resolve, which fails with *Could not resolve "fs" / "url" … in jsdom*. Mark those modules external in `angular.json` → `architect.build.options` (this is safe; that code never runs in the browser):

  ```json
  "externalDependencies": ["jsdom", "canvas"]
  ```

  The older webpack `browser` builder, Vite, webpack and esbuild do not need this.
- **Angular wrapper**: requires Angular 15 or newer.

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
  currentImageIndex?: number;      // 1-based index for multi-image flows (e.g. 2)
  totalImages?: number;            // Total images in the flow (e.g. 5) → shows "2/5" in header
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

Every control lives in exactly one place:

| Area | Contains |
|---|---|
| **Top bar** | Close (✕) · title · image counter (`2 / 5`) · Undo · Redo · Reset · Zoom out / level / in · Fullscreen · **Apply** |
| **Tool rail** | Select · Crop · Draw · Eraser · Text · Shapes · Callout · Filters · Adjust |
| **Settings panel** | Appears next to the rail for tools that have settings and hides for Select, so the photo gets the full width. Crop includes **Rotate & flip**; Filters shows live previews of the photo |

On phones (≤ 640 px) the rail becomes a scrolling bar at the bottom of the screen, the settings panel becomes a compact sheet above it, and header buttons are 44 px touch targets. Zoom and fullscreen are left to pinch gestures there.

If Crop is disabled via `disabledFeatures`, any enabled rotate / flip buttons move to the top bar.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `V` `C` `B` `E` `T` `S` | Select, Crop, Draw, Eraser, Text, Shapes |
| `R` / `Shift+R` | Rotate right / left |
| `H` / `Shift+H` | Flip horizontally / vertically |
| `+` `−` `0` | Zoom in, out, reset |
| Arrow keys (`Shift` = 10 px) | Move the crop box in Crop mode, or the selected annotation |
| `Delete` / `Backspace` | Delete the selected annotation |
| `⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z` | Undo, redo |
| `⌘/Ctrl+Enter` | Apply |
| `Esc` | Cancel crop → clear selection → close |

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

## Upgrading to 1.6.0

> **1.6.1** is a patch on top of 1.6.0 (docs, npm metadata, and new callouts are ready for typing). If you're already on 1.6.0, `npm update` is all you need.

1.6.0 is a minor release: a redesigned, accessible editor UI and a new multi-image editor. **Your existing code keeps working** (no config keys were removed or renamed), but the editor looks different and a few behaviours changed, so check the list below before upgrading.

### 1. Bump the versions

```bash
npm install @rageshpikalmunde/rp-image-editor@^1.6.0
# and if you use the framework wrappers (they depend on core ^1.6.0):
npm install @rageshpikalmunde/rp-image-editor-react@^1.6.0
npm install @rageshpikalmunde/rp-image-editor-angular@^1.6.0
```

### 2. What changes for your users

- **New layout.** One tool rail on the left (a scrolling bar at the bottom on phones). The settings panel only shows for tools that have settings. Undo, redo, reset, zoom and Apply are in the top bar, and Close is top-left. Rotate and flip moved into the Crop panel. The right-hand rail and the bottom "Quick Actions" bar are gone.
- **Zoom only changes the view.** Apply always exports the whole image. Before, applying while zoomed in exported only the visible part. If your users relied on that, ask them to use Crop. Zoom also can't go below 100% (the image fitted to the stage).
- **Brighter default accent** (`#2f6feb`, was `#083a81`). Themes that set `accent`, `toolbarActiveBackground` or `applyButtonBackground` are unaffected.
- **No default subtitle or logo badge.** The header subtitle only shows if you set `theme.headerSubtitle` or `labels.headerSubtitle`. The placeholder logo badge only shows with `headerLogo` or `showHeaderBadge: true`.
- **Accessibility:** WCAG 2.2 AA (checked with axe-core), full keyboard support, focus kept inside the modal and returned to the opener on close.
- **Fixes:** Adjust sliders can be undone, text undoes in one step, typing replaces the "Text" placeholder, and the crop dimming stays aligned with the crop box.

If you style the editor with your own CSS that targets internal `.rp-ie-*` class names, re-check it: the shell markup changed.

### 3. New and optional: edit several images at once

```typescript
import { openMultiEditorModal } from '@rageshpikalmunde/rp-image-editor';

const results = await openMultiEditorModal({ images: files, config });
// results: [{ index, edited, result }] for every image, or null if closed
```

A thumbnail strip switches images, each image keeps its own undo history, and Close asks before discarding edits. Angular: `RpImageEditorService.openMultiEditor(images, config)`. React: `useRpImageEditor().openMultiEditor(images, config)`. If you currently loop over `openEditorModal` for a batch, that loop still works.

All 1.5.x options still work unchanged. For example:

```typescript
await openEditorModal({
  image: file,
  config: {
    language: 'de',                          // 15 bundled languages
    labels: { tool: { callout: 'Annotation' } },
    filterPresets: ['none', 'grayscale', 'vintage'],
    keyboardShortcutsScope: 'editor',        // shortcuts only while focus is in the editor
    disabledFeatures: ['filters'],
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

No stored data format changed, so you can go back at any time with no code changes:

```bash
npm install @rageshpikalmunde/rp-image-editor@1.5.13
npm install @rageshpikalmunde/rp-image-editor-react@1.5.13
npm install @rageshpikalmunde/rp-image-editor-angular@1.5.13
```

## License

[MIT](./LICENSE) © [Ragesh Pikalmunde](https://github.com/rpragesh)
