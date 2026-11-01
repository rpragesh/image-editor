# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

npm-workspaces monorepo for `@rageshpikalmunde/rp-image-editor`, a browser image editor/annotator built on Fabric.js **v5** (`import { fabric } from 'fabric'`). Three published packages:

- `packages/core` — the framework-agnostic engine (all real logic lives here)
- `packages/angular` — thin Angular wrapper (`RpImageEditorModule`, `RpImageEditorComponent`, `RpImageEditorService` which calls core's `openEditorModal`)
- `packages/react` — thin React wrapper (`RpImageEditorComponent`, `useRpImageEditor` hook)

The wrappers depend on core by its published npm name/version; they only construct `RpImageEditor` or call `openEditorModal`.

## Commands

```bash
npm install --legacy-peer-deps   # what CI uses (Angular/Ionic peer deps)
npm run build:core               # tsc → dist/esm, dist/cjs, dist/types, then build-css
npm run build:all                # core, then angular, then react
npm run build:demo               # esbuild IIFE bundle (global RpImageEditor) → docs/ and mirrored to demo/
npm run clean
cd packages/core && npm run dev  # tsc --watch (ESM only)
npx serve demo                   # try changes locally after build:demo
```

```bash
npm test                                   # Playwright smoke tests (Chromium)
npx playwright test -g "rotateRight"       # single test by title
```

Smoke tests live in `tests/smoke/`. `global-setup.js` esbuilds `packages/core/src` into `tests/smoke/.bundle/` (gitignored), and `fixture.html` exposes a `window.harness` that creates an `RpImageEditor` on an 800×600 red|blue test image and samples pixels from `getResult()` output. Export sizes are compared with ±2px tolerance (`getResult()` can round 600 → 599). A test marked `test.fail()` documents a known bug; remove the marker once it's fixed. There is no linter, so also check UI changes manually in `demo/index.html`.

CI (`.github/workflows/build.yml`) runs `build:all` + `npm test` on pushes to `main` and on PRs.

`build:css` in core requires `dist/cjs` to exist — it `require`s the compiled `ui/styles.js` to emit `dist/styles/rp-image-editor.css` and writes `package.json` type markers into `dist/esm` and `dist/cjs`. Always run the full `npm run build`, not individual steps out of order.

Pushing to `main` triggers `.github/workflows/deploy-demo.yml`, which builds core + demo and deploys `docs/` to GitHub Pages. `docs/` and `demo/` bundles are committed; rebuild them with `build:demo` when core changes.

## Core architecture (`packages/core/src`)

- `editor.ts` — `RpImageEditor` (extends a typed `EventEmitter<RpEditorEvents>`). The large orchestrator: builds the DOM shell, owns the `fabric.Canvas`, the base image, zoom/pan/ghost preview, rotation/flip, filters/adjustments, export (`getResult`), and wires toolbar callbacks to the mode modules. Public API methods (`setMode`, `zoomIn`, `setColor`, `flipHorizontal`, `applyFilterPreset`, `destroy`, …) are here.
- `modal.ts` — `openEditorModal()` mounts the editor in a full-screen backdrop and returns a Promise resolving to `RpEditorResult` on Apply or `null` on close. The editor shell itself renders Apply/Close when `onApply`/`onClose` callbacks are present.
- `modules/` — one class per tool (`crop`, `draw`, `text`, `eraser`, `shape`, `callout`, `history`), each constructed by the editor with the shared canvas. `callout.ts` and `shape.ts` are the most complex (multi-object callouts with box/label/tail/anchor kept in sync; arrows with custom endpoint controls).
- `ui/toolbar.ts` — builds the grouped toolbar/rails/props panel and talks to the editor only via the `ToolbarCallbacks` interface. `ui/styles.ts` holds all CSS as the `RP_IE_CSS` string (single source of truth), injected at runtime by `ensureShellStyles()` and also emitted as the `./styles` export. `ui/icons.ts` holds inline SVGs.
- `utils/defaults.ts` — `DEFAULT_CONFIG` and `mergeConfig()` (theme merging, light-variant baseline, legacy aliases, auto-contrast foregrounds). `utils/image-processing.ts` — HEIC conversion (optional `heic2any`), EXIF orientation, iOS canvas-size downscaling.
- `i18n/` — `LocalePack` type in `types.ts`, one pack per language, `resolveLanguage` folds regional codes and aliases `sp`→`es`. Adding a UI string means updating `types.ts` and **all 15** language files. Precedence: explicit `theme`/`strings`/`filterPresetLabels`/`calloutDefaults` → `labels` → language pack → English.
- `types/index.ts` — `RpEditorConfig`, `RpEditorTheme`, events, etc.; public exports go through `index.ts`.

### Annotation object conventions

Fabric objects are tagged with custom properties: `_rpBaseImage` (the image), `_rpAnnotation` + `_rpType` (`draw`, `text`, `callout-box`/`callout-label`/`callout-tail`, …), `_rpShapeType`, `calloutId`/`calloutRole`, `_rpFullText`, arrow `x1/y1/x2/y2/arrowheadSize`. Editor logic (eraser, export, rotate/flip/crop transforms, bounds clamping, color sync) filters on these.

Undo/redo (`modules/history.ts`) snapshots via `canvas.toJSON([...])` with an explicit property whitelist. **Any new custom property that must survive undo/redo has to be added to that list**, and non-serialized state (e.g. custom controls/handle styling) must be re-applied after history restore.

Annotations must stay locked to image pixels across crop, rotate, flip, zoom and export, and be clamped/clipped to the image footprint — changes touching geometry should be checked against all of these.

## Conventions

- Source uses ESM with explicit `.js` extensions in relative imports (`'./utils/defaults.js'`) — keep this for tsc ESM output.
- Releases: versions are kept in lockstep across the root `dependencies`, the three package `package.json`s, and the wrappers' core dependency. Each release adds an entry to `packages/core/CHANGELOG.md` and updates the "Upgrading to x.y.z" section in the root `README.md`. Changes are intended to be backward-compatible (new config keys optional).
