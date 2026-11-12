# @rageshpikalmunde/rp-image-editor

An open-source JavaScript image editor, image annotation, and screenshot markup plugin built with Fabric.js for React, Angular, Ionic, Vue, Capacitor, and plain web apps.

Use it to crop, rotate, zoom, draw, add text, place callouts and shapes, apply filters, and export high-quality edited images directly in the browser.

### 🚀 **[▶ Try the Live Demo →](https://rpragesh.github.io/image-editor/)**

> One click opens a live browser demo with a sample image already loaded. No signup, no upload. Test crop, annotation, text, shapes, filters, and export in seconds.

[npm](https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor) · [GitHub](https://github.com/rpragesh/image-editor) · [API reference](https://rpragesh.github.io/image-editor/api/) · [Changelog](packages/core/CHANGELOG.md)

⚡ **Live examples on StackBlitz:** [React](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/react) · [Angular](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/angular) · [Plain HTML (CDN)](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/vanilla-cdn). Sources are in [`examples/`](examples/).

## Features

- **Free crop** and aspect-ratio locked crop — initial ratio chip matches the actual rectangle, switching between ratios (e.g. 4:3 ↔ 16:9) keeps the rect fit to the same 80% image-bounds envelope so sizes stay visually consistent, and annotations are preserved across crops
- **Zoom in/out** with pinch-to-zoom gesture support
- **Always-on drag / pan** with a translucent **ghost preview** of the image mounted behind the canvas — users always see where the image is even when panning past its bounds or zooming out, no need to first pick the drag tool
- **Rotate** left/right in 90° steps — annotations (drawings, text, shapes, callouts) are preserved and stay locked to the underlying pixels, with no cumulative drift past 360°. Fast path skips PNG re-encoding so large 10–15 MB+ images rotate quickly, and a loader overlay is shown while heavy renders are in progress.
- **Freehand draw** with configurable brush color & width
- **Add text** with inline editing, color, and font size
- **Predefined shapes** — Circle (proportion-locked), Ellipse (independent w/h), Square (proportion-locked), and Arrow (with editable start/end endpoints). All shapes are draggable, resizable, undo/redo-able, and erasable.
- **Callout annotations** — editable label box with draggable tail pointer, min-resize clamping, text constraints (max 40 chars, auto word-wrap), mobile double-tap editing, and delete button. **Selected callouts recolor live** when you pick a new color from the palette, matching the shape / text / draw tools.
- **Eraser** tool for removing annotations
- **Undo/Redo** with configurable stack depth
- **Reset** to original image
- **Native-resolution export** — output preserves the source image's intrinsic resolution; annotations stay sharp (toggle via `exportAtNativeResolution`)
- **Multi-image workflows** — pass `currentImageIndex` and `totalImages` to render a compact `2/5`-style counter in the header while users step through batches of images
- **HEIC support** — auto-converts iPhone HEIC to JPEG
- **EXIF orientation** — auto-corrects rotated photos without double-rotating portrait images in Chromium-based browsers such as Microsoft Edge
- **Smart resolution** — auto-downscales on iOS to stay within Safari canvas limits
- **Touch gestures** — pinch zoom, drag, tap on mobile
- **Theming** — fully customizable colors for header, footer, buttons, toolbar. Auto-contrast: when you customize a background without setting its paired text/icon color, a readable foreground is derived from the background's luminance, so dark themes never end up with invisible icons.
- **Internationalization (i18n)** — bundled translations for **15 languages** (`da, de, en, es, fr, it, ko, nl, pl, pt, sv, th, tr, vi, zh`) selectable via a single `language` config key. `sp` aliases to `es`; regional variants like `de-DE` or `pt_BR` are folded automatically. Per-key `labels` overrides let you rebrand individual strings or add languages beyond the built-in set.
- **Configurable defaults** — customize filter preset lists & labels, callout defaults (text / color / font size / max chars / auto line-break), header subtitle, and empty-state title/subtitle without touching source.
- **Bounds-safe editing** — text, callouts, shapes, and freehand strokes are clamped or clipped to the visible image footprint so exports stay clean after zooming, panning, fullscreen editing, or undo/redo.
- **Output** — Base64, Blob, and File object

## Packages

| Package | Description |
|---|---|
| `@rageshpikalmunde/rp-image-editor` | Core engine (vanilla TS + Fabric.js) |
| `@rageshpikalmunde/rp-image-editor-angular` | Angular wrapper: module, component and modal service (Ionic optional) |
| `@rageshpikalmunde/rp-image-editor-react` | React wrapper: inline component and `useRpImageEditor` modal hook |

## Quick Start (Angular)

Requires Angular 15 or newer.

```bash
npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-angular
```

> **Angular 17+ with the default `application` builder:** add `"externalDependencies": ["jsdom", "canvas"]` to `architect.build.options` in `angular.json`. Without it the build fails with *Could not resolve "fs" / "url"* from Fabric.js's Node-only code path. See [Bundler notes](packages/core/README.md#bundler-notes).

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

For an inline editor, use the component (import `RpImageEditorModule` into a standalone component's `imports`, or into your `NgModule`):

```html
<rp-image-editor [image]="file" [config]="config" (imageEdited)="onEdited($event)"></rp-image-editor>
```

Get the result by calling `apply()` on the component, e.g. through `@ViewChild(RpImageEditorComponent)`. That emits `imageEdited`.

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

For an inline editor, use `RpImageEditorComponent` from `@rageshpikalmunde/rp-image-editor-react`. Passing `onImageEdited` shows the editor's Apply button and gives you the result:

```tsx
<RpImageEditorComponent image={file} config={config} onImageEdited={(result) => upload(result.file)} />
```

## Quick Start (plain HTML / CDN)

No bundler needed. One script tag exposes the global `RpImageEditor`:

```html
<script src="https://unpkg.com/@rageshpikalmunde/rp-image-editor@1/dist/browser/rp-image-editor.min.js"></script>
<script>
  async function edit(file) {
    const result = await RpImageEditor.openEditorModal({ image: file });
    if (result) console.log(result.file); // upload via FormData
  }
</script>
```

For HEIC/HEIF photos, also load `https://unpkg.com/heic2any@0.0.4/dist/heic2any.js` before it. More in [the core README](packages/core/README.md#without-a-bundler-cdn--script-tag).

## Server-side rendering (SSR)

You can import the packages on the server, but the editor itself only runs in the browser. Open it from user actions such as clicks, or from `useEffect` / `ngAfterViewInit`. Both wrapper components are SSR-safe: they create the editor only in the browser. For Next.js, Angular SSR, Nuxt and SvelteKit specifics, see [Server-side rendering](packages/core/README.md#server-side-rendering-ssr).

## Internationalization

Swap the whole shell to any of the 15 bundled languages with one config key:

```ts
await openEditorModal({
  image: file,
  config: { language: 'de' },   // → top bar, rails, props panel, callouts … all in German
});
```

| Code | Language | | Code | Language | | Code | Language |
|---|---|---|---|---|---|---|---|
| `da` | Dansk       | | `en` | English    | | `it` | Italiano   |
| `de` | Deutsch     | | `es` | Español    | | `ko` | 한국어      |
| `fr` | Français    | | `nl` | Nederlands | | `pl` | Polski     |
| `pt` | Português   | | `sv` | Svenska    | | `th` | ไทย        |
| `tr` | Türkçe      | | `vi` | Tiếng Việt | | `zh` | 中文       |

- `sp` is accepted as a convenience alias for `es`.
- Regional variants (`de-DE`, `pt_BR`, `zh-CN`, …) are folded to the primary tag.
- Unknown or missing codes fall back to English.

### Per-key label overrides

Use `config.labels` (deep-partial `LocalePack`) to rebrand individual strings, or to provide a translation for a language that isn't in the built-in set:

```ts
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

**Precedence** (highest wins): explicit `theme` / `strings` / `filterPresetLabels` / `calloutDefaults` → `labels` → `language` pack → English fallback.

## More configurability

Recent releases expose the following config keys:

| Key | What it does |
|---|---|
| `filterPresets` | Whitelist and order the built-in one-click filter tiles. |
| `filterPresetLabels` | Rename individual filter tiles (e.g. `{ grayscale: 'Mono' }`). |
| `calloutDefaults` | Defaults for new callouts: `text`, `color`, `textColor`, `fontSize`, `maxChars`, `lineBreakAt`. |
| `strings.emptyStateTitle` / `strings.emptyStateSubtitle` | Customize the drop-zone copy. Pass `''` for the subtitle to hide the row. |
| `theme.headerSubtitle` | Customize the subtitle rendered under the header title. Pass `''` to hide it. |
| `currentImageIndex` / `totalImages` | Show a compact `current/total` image counter in the editor header for multi-image review flows. |

See [`packages/core/CHANGELOG.md`](packages/core/CHANGELOG.md) for the latest release notes.

## Upgrading to 1.6.0

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

### Hiding tools you don't want (including Filters)

Every toolbar tile is addressable by id via `disabledFeatures`. To remove the **Filters** tile from the menu entirely:

```typescript
await openEditorModal({
  image: file,
  config: {
    disabledFeatures: ['filters'],           // hide the Filters tile
    // disabledFeatures: ['filters', 'adjust'], // hide Filters + Adjust
  },
});
```

See the [core README's Disabling Features](packages/core/README.md#disabling-features) section for the full list of tool ids and group aliases.

### Rolling back

No stored data format changed, so you can go back at any time with no code changes:

```bash
npm install @rageshpikalmunde/rp-image-editor@1.5.13
npm install @rageshpikalmunde/rp-image-editor-react@1.5.13
npm install @rageshpikalmunde/rp-image-editor-angular@1.5.13
```

## License

MIT
