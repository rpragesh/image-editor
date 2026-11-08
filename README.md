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

## Upgrading to 1.5.13

**Nothing in your existing code has to change.** 1.5.13 is a backward-compatible patch release, and the editor itself is unchanged. It fixes the framework wrappers. The Angular wrapper now works in production (AOT) builds without loading `@angular/compiler`, and `<rp-image-editor>` works in AOT templates. The React `RpImageEditorComponent` now calls `onImageEdited` when Apply is clicked. The release also adds a `<script>`-tag/CDN build, an [API reference](https://rpragesh.github.io/image-editor/api/) and [live examples](https://github.com/rpragesh/image-editor/tree/main/examples). From 1.5.12 you also have exact undo/redo for crop, rotate, flip and filters.

**Angular users, check two things:**
- The wrapper now needs **Angular 15 or newer**.
- On **Angular 17+ with the esbuild `application` builder**, add `"externalDependencies": ["jsdom", "canvas"]` to `angular.json` (see [Bundler notes](https://github.com/rpragesh/image-editor/blob/main/packages/core/README.md#bundler-notes)).

If you added `import '@angular/compiler'` only to make the wrapper run, you can remove it now.

### 1. Bump the versions

```bash
npm install @rageshpikalmunde/rp-image-editor@^1.5.13
# and if you use the framework wrappers (they depend on core ^1.5.13):
npm install @rageshpikalmunde/rp-image-editor-react@^1.5.13
npm install @rageshpikalmunde/rp-image-editor-angular@^1.5.13
```

### 2. Existing integrations keep working unchanged

There are no new editor APIs or config keys in 1.5.13. React's `onImageEdited` now shows the editor's Apply button, as it was documented to; if you don't want that button, don't pass the prop. From 1.5.11 you also have the optional `keyboardShortcutsScope: 'editor'`, which makes shortcuts react only while focus is inside the editor (the default `'global'` keeps the current behavior), and the Angular wrapper no longer requires `@ionic/angular` to be installed. The broader 1.5.x additions below remain fully optional, and your existing config shape does not need to change.

Add any subset of the new keys to your existing `config` object. You do **not** need to remove or restructure anything you already pass:

```typescript
await openEditorModal({
  image: file,
  config: {
    // ...everything you already had in 1.4.x still works, unchanged...

    // Optional image counter for multi-image flows
    currentImageIndex: 2,
    totalImages: 5,

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

1.5.13 is additive. No public data or storage format changed, so you can downgrade at any time with no code changes (Angular apps on 1.5.12 need `import '@angular/compiler'` in `main.ts` again):

```bash
npm install @rageshpikalmunde/rp-image-editor@1.5.12
npm install @rageshpikalmunde/rp-image-editor-react@1.5.12
npm install @rageshpikalmunde/rp-image-editor-angular@1.5.12
```

## License

MIT
