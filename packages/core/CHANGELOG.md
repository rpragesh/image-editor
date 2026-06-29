# Changelog

All notable changes to `@rageshpikalmunde/rp-image-editor` will be documented in this file.

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
