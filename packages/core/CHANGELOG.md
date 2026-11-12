# Changelog

All notable changes to `@rageshpikalmunde/rp-image-editor` will be documented in this file.

## [1.6.0] — 2026-11-12

Minor release: a redesigned, accessible editor UI and multi-image editing (`openMultiEditorModal`). Existing config keeps working; see "Upgrading to 1.6.0" in the README for behaviour changes (zoom is view-only, new layout, brighter default accent).

### Changed
- **Redesigned editor UI.** Every control now lives in one place: the right-hand rail and the bottom "Quick Actions" bar are gone. Undo, redo, reset and zoom moved to the top bar, Close moved to the top-left, and rotate / flip moved into the Crop panel. The settings panel only appears for tools that have settings, so Select mode gives the photo the full width. The canvas no longer has a double frame.
- **Proper phone layout** (≤ 640 px): the tools are a scrolling bar at the bottom with edge fades, settings are a compact sheet above it, the Close button is always visible, and header buttons are 44 px touch targets. Before, Close was pushed off-screen and four tools were hidden.
- **Default accent is now a brighter blue** (`#2f6feb`, was navy `#083a81`) so Apply and the active tool stand out. Themes that set `accent`, `toolbarActiveBackground` or `applyButtonBackground` are unaffected.
- **Header subtitle only shows when you set one** (`theme.headerSubtitle` or `labels.headerSubtitle`); the generic "Edit your image with ease" tagline is no longer shown by default. The placeholder logo badge only shows when `headerLogo` is set or `showHeaderBadge: true`.
- Crop box restyled: white frame and handles, rule-of-thirds guides (previously not drawn), and the area being kept stays bright while the rest dims.
- **Zoom is view-only: Apply always exports the whole image.** Before, applying while zoomed in exported only the part visible on screen (zoom acted as a crop). Use Crop to cut the image; if you relied on the old behaviour, crop before applying.
- **Zoom can't go below 100%** (the image fitted to the stage). The zoom menu offers 100% (Fit), 150%, 200%, 300% and 400%; `setZoom()` clamps to the same range.
- Rotating or flipping keeps you in the current tool (it used to drop back to Select), and Crop remembers the chosen aspect ratio.

### Fixed
- The dimmed area around the crop box could drift away from it after flipping or resizing the editor while cropping, leaving a second, offset bright area.
- **Adjust sliders (brightness, contrast, saturation, blur) are now undoable.** They were never recorded in undo history, so Undo skipped them, and in multi-image an adjust-only edit didn't count as an edit. Each slider release is now one undo step, and an export taken right after moving a slider includes the change.
- **Text: one Undo removes a text edit.** Text that grew past the image edge was pulled back inside as a separate undo step, so the first Undo seemed to do nothing.
- **Text: typing replaces the "Text" placeholder** instead of being inserted in front of it, and a text box left empty is removed.
- **Opening a panel or resizing no longer leaves "empty" undo steps.** History stored on-screen coordinates, so after any layout change the next save looked like an edit.
- **The active tool keeps working after `getResult()`.** Exporting switched the tool off to hide its overlays and never switched it back on, so an inline editor that exported mid-session couldn't draw until another tool was picked.

### Added
- Angular `RpImageEditorService.openMultiEditor(images, config?, startIndex?)` and React `useRpImageEditor().openMultiEditor(...)` wrap the new multi-image modal.
- `commitAdjustments()` records programmatic `setAdjustment()` calls as one undo step.
- **`openMultiEditorModal({ images, config, startIndex })`** edits several images in one editor. A thumbnail strip under the photo (with previous/next buttons) switches between them. Each image keeps its own edits and undo history and is loaded the first time it's opened. Apply resolves with `{ index, edited, result }` for every image (unedited ones are exported too, with `edited: false`). Close resolves with `null` and first asks "Discard changes to N images?" if anything was edited. New `multi` strings in all 15 languages (optional in `LocalePack`).
- **Filter tiles show previews of your photo** (with its current crop, rotation and flip), computed with the same math as the filters.
- **Accessibility (WCAG 2.2 AA, checked by axe-core in CI):** the modal is a labelled dialog, Tab stays inside it, focus returns to the opener on close, every control has a visible focus ring and an accessible name, sliders are labelled, and toggles expose `aria-pressed`. Honors `prefers-reduced-motion`.
- **Keyboard:** arrow keys move the crop box or the selected annotation (Shift = 10 px; one undo step per burst), Delete/Backspace removes the selected annotation, and Escape backs out one level (cancel crop → clear selection → close).
- `props.transform` locale string ("Rotate & flip") in all 15 languages. Optional in `LocalePack`, so hand-built packs still type-check.

## [1.5.13] — 2026-11-08

Patch release that fixes the Angular and React wrappers and adds a `<script>`-tag build, API reference and live examples. No changes to the editor itself.

### Fixed
- **Angular wrapper now works in production (AOT) builds** — it was compiled with plain `tsc` instead of Angular's compiler, so apps failed at startup with *JIT compiler unavailable* unless they also loaded `@angular/compiler`, and `<rp-image-editor>` could not be used in AOT templates. It is now built with ng-packagr in Angular Package Format, and tested with Angular 15 and 17. Your code does not change. It now needs **Angular 15 or newer** (the peer range said 14), and the package no longer has a CommonJS (`require`) entry; Angular apps never use one.
- **React `RpImageEditorComponent` now calls `onImageEdited`** — the prop was documented but never called. Passing it now shows the editor's Apply button, which returns the edited image. `config.onApply` still runs as well.
- **Angular `<rp-image-editor>` is safe under SSR** — it no longer tries to create the editor during server rendering; it starts in the browser.

### Added
- **CDN / `<script>`-tag build** at `dist/browser/rp-image-editor.min.js` (global `RpImageEditor`; ~500 KB minified, ~145 KB gzipped, Fabric.js included). It is served by `https://unpkg.com/@rageshpikalmunde/rp-image-editor@1.5.13` and jsDelivr, and can also be imported as `@rageshpikalmunde/rp-image-editor/browser`. HEIC support uses a page-level `heic2any` script if one is loaded.
- **API reference** generated with TypeDoc at https://rpragesh.github.io/image-editor/api/.
- **Live examples** for React, Angular and plain HTML in `examples/`, each with a StackBlitz link.
- **Docs**: notes on server-side rendering (Next.js, Angular SSR, Nuxt, SvelteKit), and the `externalDependencies: ["jsdom", "canvas"]` setting needed by Angular 17+'s esbuild builder.
- `ImageFilterPreset` and `ImageAdjustments` are now exported as types (they were already used by public APIs).

## [1.5.12] — 2026-11-08

Patch release making undo/redo exact for image edits, and fixing flip and filter handling in rotate and crop. No API changes.

### Fixed
- **Undo/redo now restores image edits exactly** — undo only rolled back the canvas, not the editor's rotation, crop source or filter state. Rotating after undoing a rotation turned the image to 180°, rotating after undoing a crop brought the cropped image back, and undoing a filter left the Filters panel showing it as active. Every history step now records the full image state.
- **Undo history is far lighter** — each step used to embed the whole image as a data URL (and re-encode it as PNG on every pen stroke after a rotation). Steps now store only the annotations plus a small image-state record: on a 3000×2000 photo, about 150 KB → under 1 KB per step, and saving a step dropped from ~18 ms to ~0 ms.
- **A flipped image stays flipped when rotated** — rotation rebuilt the image without its flip, so the picture un-mirrored while annotations stayed mirrored and no longer lined up.
- **A flipped image stays flipped when cropped**, and the crop takes the region you selected rather than its mirror image.
- **Cropping with a filter or adjustment active no longer applies it twice** — the crop copied the already-filtered pixels and the filter was then applied again on top.

## [1.5.11] — 2026-11-01

Patch release fixing export dimensions and keyboard shortcuts on pages with more than one editor. No breaking changes.

### Fixed
- **Exports now come out at the image's exact native size** — the on-screen width and height are rounded to whole pixels separately, so the two display scales could differ slightly, and export only inverted the horizontal one. An 800×600 image exported as 800×599 (1600×1198 at `exportPixelRatio: 2`). Each axis is now inverted on its own.
- **Rotated images no longer gain a 1px transparent edge** — floating-point noise in cos(90°) made the rotated canvas one pixel too large (e.g. 1234×777 rotated to 778×1234).
- **Several editors on one page no longer all react to the same shortcut** — shortcuts listen on `window`, so every mounted editor ran R, ⌘Z, Escape and the rest. Now only the most recently created, clicked or focused editor responds, and a key press inside one editor never reaches another. A single editor behaves exactly as before.
- **Angular wrapper no longer requires Ionic** — `@ionic/angular` is now an optional peer dependency; the wrapper never used it.

### Added
- **`keyboardShortcutsScope`** (optional, default `'global'`) — set to `'editor'` so shortcuts only react while focus is inside the editor, which keeps inline editors from capturing page-level keys.

## [1.5.10] — 2026-09-23

Patch release fixing image flip behavior so annotations stay aligned with the mirrored image. No API changes.

### Fixed
- **Horizontal and vertical image flips now move annotations with the image** — text, shapes, draw polylines, arrows, and callouts are mirrored across the base image center when the image is flipped, so overlays no longer stay behind on the pre-flip side.
- **Callout tails stay attached after flips** — callout boxes/anchors are mirrored first and tails are regenerated from the flipped geometry, preventing detached or stale tail segments after a flip.

## [1.5.9] — 2026-09-23

Patch release tightening crop aspect-ratio behavior.

### Fixed
- **Aspect-ratio crop mode now stays inside the image bounds** — switching crop ratios now recomputes the rectangle from the image bounds instead of stretching the existing width, so the crop box no longer overflows the image and exports no longer pick up blank strips.
- **Crop ratio switches keep the box centered and the controls consistent** — the crop rect now recenters itself when the ratio changes and always applies the correct locked/unlocked handle state for crop mode.

## [1.5.8] — 2026-09-21

Patch release focused on annotation text-state reliability. No API changes.

### Fixed
- **Text annotation controls now survive undo/redo** — Fabric does not serialize the custom text-control styling, so restoring history could bring back plain square handles. The editor now re-applies the expected text interaction styling after history rehydration.
- **Callout labels now preserve their full text through history and resize flows** — callout label state now serializes the full untruncated text, so undo/redo and older restored annotations keep their editable content instead of only the shortened preview.
- **Callout ellipsis is now reversible and readable** — when a callout box is too small, the preview now shortens by whole words where possible, restores the full text before fit calculations, and reveals more content again as the box grows.

## [1.5.6] — 2026-09-18

Patch release fixing an EXIF orientation issue that could rotate portrait photos sideways when opened in Chromium-based browsers such as Microsoft Edge.

### Fixed
- **Portrait images now keep the correct orientation** — the editor now loads image sources using the browser's orientation-aware bitmap path and only applies fallback EXIF rotation when the browser has not already corrected the pixels.
- **No double-rotation on Chrome / Edge** — the previous manual EXIF rotation was being applied after the browser had already normalized the image, which flipped portrait photos into landscape.

## [1.5.5] — 2026-09-18

Patch release focused on annotation geometry and callout editing stability. No API changes.

### Fixed
- **Shape and line-path bounds now follow the visible geometry** — arrow endpoints and polyline vertices are measured from their actual points instead of the padded Fabric hit-test box, so image containment and resize/crop clamping stay correct.
- **Arrow controls stay aligned while zoomed** — the custom endpoint handles now map the stored canvas coordinates through the viewport transform, so they no longer drift away from the shape under zoom or pan.
- **Callout editing now preserves box/label/anchor sync** — callout labels use fixed-size wrapping textboxes with proper overflow handling, and the box, dashed border, tail, and anchor stay locked together through move, resize, rotate, and undo/redo.

## [1.5.4] — 2026-08-12

Patch release focused on color-state consistency across annotation tools. No API changes.

### Fixed
- **Unified active color state across annotation tools** — Draw, Text, Shapes, and Callout now stay synchronized to one active color source, so changing color in one context is reflected everywhere.
- **Palette highlight now reflects the true active color** — the selected swatch is no longer tied to the first palette index; it tracks the currently active/default color and remains correct when switching tools.
- **Custom color picker now updates the visible palette selection** — selecting a custom color adds/updates a dynamic swatch in the main palette and marks it as selected, keeping UI state aligned with runtime color state.

## [1.5.3] — 2026-08-06

Patch release fixing shape handle alignment during fullscreen/resize and callout erasing edge cases. No API changes.

### Fixed
- **Line-path & arrow vertex handles now track the shape in fullscreen** — arrow endpoints and polyline (line-path) vertices are stored in absolute canvas coordinates, so re-fitting the base image on fullscreen/resize previously scaled the drawn line but left the draggable dots behind. The geometry (and stroke width) is now remapped in place so the handles stay locked to the line in both regular and fullscreen modes.
- **Callout erasing no longer leaves an orphaned tail** — deleting a callout now sweeps every canvas object tagged with the callout id (not just the handle's cached references), so a rehydrated tail belonging to a different object instance is removed with the rest of the callout.
- **Callout tail no longer reappears after erasing** — callout parts are made non-interactive while the eraser is active, preventing a stray box move-transform from re-inserting the just-erased tail; interactivity is restored when the eraser is deactivated.
- **Callout tail stays attached when the box is rotated** — the tail geometry now uses the box center point and angle, so it renders correctly after an image rotation.

## [1.5.2] — 2026-08-05

Patch release focused on fullscreen/resize annotation stability. No API changes.

### Fixed
- **Draw stroke clipping after fullscreen resize** — freehand path clip-paths are now rebuilt and cache-invalidated when base-image geometry changes, preventing partially cropped or missing strokes after resize/fullscreen transitions.
- **Undo/redo after fullscreen no longer restores stale image geometry** — after history restores, the base image and existing annotations are re-fit to the current wrapper size so content remains centered and correctly aligned instead of shrinking into the top-left.

## [1.5.0] — 2026-08-05

Minor release focused on multi-image workflows and stronger annotation reliability. Backward-compatible with 1.4.x.

### Added
- **Multi-image flow header counter** — new `currentImageIndex` and `totalImages` config fields render a compact `current/total` indicator (for example `2/5`) in the top bar, which helps when the editor is embedded in image-review or gallery flows.

### Changed
- **Zoom controls now respect the real editor bounds** — the toolbar correctly allows zooming out to `0.25x` and disables/enables zoom buttons based on the actual min/max zoom range.
- **Properties panel header cleanup** — removed the non-functional collapse chevron so the panel no longer suggests hidden behavior that does not exist.

### Fixed
- **Fullscreen text editing reliability** — Fabric's hidden textarea is now hosted inside the editor subtree, so typing into text annotations continues to work in fullscreen mode and after focus shifts.
- **Keyboard shortcuts no longer hijack text entry** — while an `IText` annotation is actively being edited, global shortcuts are suppressed so typed keys go to the text box instead of changing tools or zoom.
- **Annotations stay inside the image footprint** — newly created or modified text, shapes, and callouts are clamped to the visible image bounds, and draw paths are clipped so strokes made in the letterbox area do not leak into exports.
- **Callouts survive mode switches and undo/redo more cleanly** — existing callouts regain interactivity when re-entering callout mode, and runtime callout handles are rehydrated after history restores so editing, tails, and selection behave correctly.
- **Callout erasing is now precise** — the eraser uses per-pixel tail hit testing so tapping near a full-canvas tail bitmap no longer deletes the wrong callout.
- **Shape endpoint/resize bounds are enforced consistently** — arrow/polyline control points and scalable shapes are constrained against the image area, preventing handles from pushing annotations outside the editable region.

## [1.4.1] — 2026-07-24

### Fixed — docs
- Removed a stale `demo/screenshot.png` reference from the README that was rendering as a broken image on npm. The **Try the Live Demo** CTA above it already gives a one-click preview of the editor.

No code changes. Bundle is byte-identical to `1.4.0`.

## [1.4.0] — 2026-07-24

Major configurability + i18n release. Every addition is backward-compatible; consumers who upgrade without touching config get the same UI as 1.3.0.

### Added — theme / chrome
- **`theme.headerSubtitle`** — customize the subtitle rendered under the header title. Pass `''` to hide the row entirely. Default: `'Edit your image with ease'`.

### Added — filters
- **`filterPresets`** — whitelist and order the built-in one-click filter tiles. Accepts any subset of `'none' | 'grayscale' | 'sepia' | 'vintage' | 'cool' | 'warm' | 'invert'`. Unknown ids are dropped silently; an empty result falls back to the canonical order.
- **`filterPresetLabels`** — rename individual filter preset tiles without changing behaviour. Partial `Record<ImageFilterPreset, string>`; missing keys use the built-in label.

### Added — callouts
- **`calloutDefaults`** — configure the defaults applied to newly-placed callouts:
  - `text` — initial label text (default `'Label'`)
  - `color` — box background (falls back to `defaultBrushColor`)
  - `textColor` — label text color (default `'#ffffff'`)
  - `fontSize` — label font size in pixels (default `20`)
  - `maxChars` — character cap for the label (default `40`)
  - `lineBreakAt` — auto-linebreak position (default `15`)

### Added — empty state
- **`strings.emptyStateTitle`** — override the empty-state title (default `'Drop an image or click to upload'`).
- **`strings.emptyStateSubtitle`** — override the empty-state subtitle (default `'Supported: PNG, JPEG, HEIC'`). Pass `''` to hide the row.

### Added — internationalisation (15 languages)
- **`config.language`** — two-letter code that swaps every user-facing string in the editor shell (top bar, rails, empty state, props panel, filter tiles, callout defaults) to a bundled translation. Supported: `da, de, en, es, fr, it, ko, nl, pl, pt, sv, th, tr, vi, zh`.
  - `sp` is accepted as a convenience alias for `es`.
  - Regional variants such as `de-DE`, `pt_BR`, `zh-CN` are folded to their primary tag.
  - Unknown or missing codes fall back to English.
- **`config.labels`** — deep-partial per-key overrides layered on top of the resolved language pack. Use to:
  - rebrand individual labels (e.g. rename `'Callout'` → `'Annotation'`)
  - translate to a language not in the built-in set (pass a full `labels` object with no `language`; missing keys fall through to English)
  - mix and match (e.g. `language: 'de'` plus a few local tweaks)
- **New public exports:**
  - `getLocalePack(input?)`, `resolveLanguage(input?)` — runtime helpers
  - Types: `LanguageCode`, `LocalePack`, `LocalePackOverrides`

### Precedence rules
For any given string the editor resolves it in this order (highest wins):

1. Explicit field on `theme`, `strings`, `filterPresetLabels`, or `calloutDefaults`
2. `config.labels` per-key override
3. Language pack selected via `config.language`
4. English fallback pack

### Changed
- `DEFAULT_CONFIG.theme` no longer hard-codes English values for `headerTitle`, `cancelButtonText`, or `applyButtonText`. Those fields are now filled by the resolved locale pack so language selection actually takes effect. Consumers that overrode any of these strings on `theme` are unaffected — per-key overrides still win.

## [1.3.0] — 2026-07-23

### Added
- **Translucent ghost preview for pan / zoom** — a low-opacity copy of the base image is now mounted behind the Fabric canvas and follows every viewport transform (mouse move, wheel zoom, pinch, `setZoom`, resize observer, `refreshBaseImageRef`, `installBaseImage`). When the user pans past the image bounds or zooms out, the "outside" area no longer shows a solid background hiding the picture — the ghost provides continuous visual context of where the image is.
- **Always-on drag** — panning the image no longer requires selecting the drag tool from the toolbar. The ghost preview stays visible by default so users always understand where the image is positioned inside the viewport.
- **Live callout color updates** — changing the color from the toolbar color picker while a callout is selected now recolors the callout's box fill and tail on the fly, matching the existing behaviour of the shape module. Works for single selection and multi-select (`activeSelection`). New callouts still adopt the current color as before.

### Fixed
- **Initial crop aspect-ratio chip was inconsistent with the actual rectangle** — activating crop mode now honours the first entry of `cropAspectRatios` (e.g. 4:3) instead of falling back to a free crop while the chip visually reads as "active".
- **Crop rectangle size drifted between aspect ratios** — switching from 4:3 to 16:9 (or any other ratio) no longer keeps the current width and recomputes height, which used to make 4:3 look larger than 16:9. `setAspectRatio()` now fits the rectangle into 80% × 80% of the image bounds using the same algorithm as the initial activation and preserves the rect's center point.

## [1.2.0] — 2026-06-29

### Added
- **Annotations preserved across rotate** — rotating the base image no longer wipes drawings, text, shapes, or callouts. All annotations are re-anchored to the rotated image using a fixed-baseline transform so they stay visually locked to the underlying pixels.
- **No-drift cumulative rotation** — each annotation now stores a one-time rotation baseline. Every rotate applies the full cumulative angle from that baseline instead of compounding per-step deltas, so annotations no longer drift after multiple 360°+ rotations.
- **Loader overlay on rotate** — a lightweight spinner overlay (`showLoader()` / `hideLoader()`) is shown while a rotation is in progress so heavy images (10–15 MB+) provide immediate visual feedback. A double `requestAnimationFrame` yield (`nextPaint()`) ensures the overlay actually paints before the synchronous render work starts.
- **Auto-contrast theme foregrounds** — `mergeConfig()` now derives `headerTextColor`, `toolbarIconColor`, and `cancelButtonTextColor` from the paired background's WCAG relative luminance whenever the caller supplies a custom background but omits the foreground. Eliminates the "invisible dark icons on dark toolbar" trap. Explicit user overrides always win.

### Changed
- Rotation now skips the `toDataURL('image/png')` + Fabric re-decode round trip. The rotated `HTMLCanvasElement` is passed directly into `new fabric.Image()` and a cached `processedSourceImage` is reused, making rotation dramatically faster on large images.
- `loadImageOntoCanvas()` refactored to share an `installBaseImage()` helper with the new `loadImageElementOntoCanvas()` fast path.
- `applyCrop()` now resets `cumulativeRotation`, `rotationImageBaseline`, and per-annotation `_rpRotBaseline` so post-crop rotations start from a clean baseline.
- Dark-theme polish for the toolbar UI: crop ratio chips, Cancel chip, and Size label use brighter idle borders (`rgba(255,255,255,0.55)`), a faint idle background plate (`rgba(255,255,255,0.08)`), and `font-weight: 600`. Toolbar SVG `stroke-width` bumped from `2` to `2.2` (only when `stroke="currentColor"`) so icons read clearly on dark backgrounds while staying neutral on light themes.

### Fixed
- Annotations being deleted when the image is rotated (regression from the v1.1.0 rotate pipeline).
- Annotations visually orbiting their corner instead of their center after rotation (now uses `obj.getCenterPoint()` + `setPositionByOrigin(..., 'center', 'center')`).
- Cumulative floating-point drift of annotations after rotating past 360° multiple times.
- Toolbar icons invisible when callers customize `toolbarBackground` without also setting `toolbarIconColor`.

## [1.1.0] — 2026-06-09

### Added
- **Predefined shape tools** — new "Shapes" flyout group in the toolbar with four primitives:
  - **Circle** — perfect circle, proportion locked (uniform scaling only)
  - **Ellipse** — independent width/height with full side + corner handles
  - **Square** — perfect square, proportion locked (uniform scaling only)
  - **Arrow** — line with arrowhead. Custom Fabric subclass (`rpArrow`) with two dedicated endpoint handles so the user can drag either tip to change length, direction, or start/end position. The whole arrow is also draggable to reposition.
- All shapes are stored as editable Fabric objects (`_rpAnnotation`, `_rpShapeType`) — they participate in undo/redo, the eraser tool, the color picker, the size slider, and the delete button.
- Drag-to-draw gesture for every shape; shapes show resize handles immediately on release.
- New `EditorMode` values: `shape-circle`, `shape-ellipse`, `shape-square`, `shape-arrow`.
- New exported type: `ShapeType` (`'circle' | 'ellipse' | 'square' | 'arrow'`).
- New config options:
  - `defaultShapeColor` — default stroke color for shapes (defaults to `defaultBrushColor`).
  - `defaultShapeStrokeWidth` — default stroke width for shapes (default `3`).
  - `exportAtNativeResolution` — when `true` (default), the exported image is rendered at the source image's intrinsic resolution. Annotations are scaled up to match, so cropping or shape annotations no longer reduce output resolution.
- **Annotations preserved across crop** — applying a crop no longer wipes drawings, text, shapes, or callouts. Existing annotations are translated and rescaled to match the new cropped image and stay aligned. Users can now crop as many times as they like without losing their work.
- New `CalloutModule.refreshAllTails()` API — refreshes the off-screen tail bitmaps after canvas resize (called automatically after crop).

### Changed
- `getResult()` export now defaults to native resolution. Previously the export size matched the on-screen canvas (which is downscaled to fit the editor wrapper); pass `exportAtNativeResolution: false` to restore the legacy behaviour.
- `CropModule.applyCrop()` now also returns `cropRectCanvas` and `oldDisplayScaleX/Y` so callers can reposition annotations across the crop transform.
- History serialization includes `_rpShapeType`, `x1`, `y1`, `x2`, `y2`, and `arrowheadSize` so shape annotations (especially arrows) round-trip cleanly through undo/redo.
- Brush-width slider in the sub-panel is now also shown for the shape tools so the user can adjust stroke thickness.
- Build script (`scripts/build-demo.js`) now mirrors the bundle into both `docs/` and `demo/` so local serving always picks up the latest build.

### Fixed
- Image resolution loss on export — adding shape/arrow/text annotations no longer downscales the exported image. The output now matches the source image's native dimensions (subject to `maxResolution` clamping during load).

## [1.0.5] — 2026-03-13

### Added
- **Callout improvements** — complete overhaul of the callout annotation module:
  - Callout ID tracking — each callout's 5 Fabric objects tagged with unique `calloutId` and `calloutRole`
  - Text constraints — max 40 characters with ellipsis, auto word-wrap at ~15 characters
  - Min-resize clamping — box cannot shrink below the label's natural size + minimum padding
  - Mobile double-tap editing — 350ms threshold for entering inline text edit on touch devices
  - Desktop double-click editing on the background rect focuses the label for inline editing
  - Cached intrinsic label dimensions to prevent floating-point drift during repeated scaling
  - Centered label inside box during scaling (uniform scale, never shrinks below 1×)
  - Visual improvements: rounded corners (rx/ry 8), drop shadow, `#0ea5e9` accent color
  - Tail gap fix: 25px base overlap eliminates the visual gap between tail and box edge
  - Smooth tail rendering: `lineJoin: round`, `lineCap: round`, improved base proportions
- **Delete annotation** — new `deleteSelected()` API on `CalloutModule`, plus a trash button in the toolbar sub-panel when callout mode is active
- **Export cleanup** — `getResult()` now hides all callout borders/anchors before rendering, restores after
- **History fix** — `object:added` listener now checks `_rpType?.startsWith('callout')` instead of `=== 'callout'`, so callout additions properly trigger undo history saves
- **History serialization** — `calloutId` and `calloutRole` are now included in `toJSON()` for proper undo/redo

### Changed
- **Rotation** — now rotates in 45° steps (changed from 90°)
- **Lossless cumulative rotation** — rotation always operates from the original image with cumulative angle, eliminating progressive quality/size loss on repeated rotations
- **Rotation bounding box** — proper trigonometric bounding box calculation for any rotation angle (not just 90°/270°)
- **Toolbar** — `ToolbarCallbacks` interface now includes optional `onDeleteAnnotation` callback
- **CalloutOptions** — extended with optional `maxChars` and `lineBreakAt` fields

### Fixed
- Repeated rotation causing image to shrink and eventually disappear
- Tail visual gap between the triangle base and the callout box edge
- Callout additions not triggering undo history saves

## [1.0.4] — 2026-03-10

### Added
- Initial callout annotation module with draggable tail pointer
- Callout icon in the Annotate toolbar flyout
- Color picker sub-panel for callout mode

## [1.0.3] — 2026-03-08

### Added
- Grouped toolbar with flyout menus (Zoom, Transform, Annotate)
- `disabledFeatures` config to hide tools or groups

## [1.0.2] — 2026-03-05

### Added
- Text annotation module with inline editing
- Eraser tool

## [1.0.1] — 2026-03-02

### Fixed
- HEIC conversion improvements
- EXIF orientation detection

## [1.0.0] — 2026-02-28

### Added
- Initial release
- Crop, zoom, rotate, freehand draw, undo/redo, reset
- HEIC support, EXIF correction, smart resolution
- Touch gestures, theming, modal UI
- Angular, React wrappers
