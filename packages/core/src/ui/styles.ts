/**
 * Runtime stylesheet for the editor shell. Kept in TS so the shell
 * can auto-inject it into the host document on first construction
 * (making the IIFE bundle "just work" with no separate CSS import)
 * while the build-css.js script still emits the same content to
 * `dist/styles/rp-image-editor.css` for consumers who prefer to load
 * it explicitly (e.g. via a bundler's CSS pipeline).
 */

export const RP_IE_CSS = `
/* rp-image-editor — shell styles (Figma + Linear direction) */

.rp-editor-modal-backdrop,
.rp-ie-modal-backdrop {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 99998;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; box-sizing: border-box;
}

.rp-editor-modal,
.rp-ie-modal {
  width: 100%;
  max-width: var(--rp-ie-modal-max-width, 1200px);
  height: var(--rp-ie-modal-height, min(92vh, 820px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.55);
  border-radius: var(--rp-ie-modal-radius, 16px);
  background: transparent;
  position: relative;
  z-index: 99999;
}

.rp-editor-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.rp-editor-canvas-wrapper canvas { display: block; }

.rp-ie-root {
  --rp-ie-surface-0: #0B0D12;
  --rp-ie-surface-1: #12151C;
  --rp-ie-surface-2: #181C25;
  --rp-ie-border: rgba(255,255,255,0.06);
  --rp-ie-text: #ECEEF3;
  --rp-ie-text-muted: #8A93A6;
  --rp-ie-accent: #083a81;
  --rp-ie-accent-rgb: 8, 58, 129;
  --rp-ie-accent-contrast: #FFFFFF;
  --rp-ie-cta: var(--rp-ie-accent);
  --rp-ie-cta-text: var(--rp-ie-accent-contrast);
  --rp-ie-radius: 10px;
  --rp-ie-radius-sm: 8px;
  --rp-ie-radius-lg: 16px;
  --rp-ie-danger: #F85149;
  --rp-ie-success: #3FB950;
  --rp-ie-warning: #D29922;

  /* Theme-aware component tokens. Overridden per variant below so
   * component rules can reference them without needing per-theme
   * specificity gymnastics. */
  --rp-ie-track: var(--rp-ie-surface-2);
  --rp-ie-track-center: var(--rp-ie-border);
  --rp-ie-thumb-border: var(--rp-ie-surface-1);
  --rp-ie-thumb-shadow: 0 1px 4px rgba(0,0,0,0.4);
  --rp-ie-danger-bg: rgba(248,81,73,0.14);
  --rp-ie-danger-bg-hover: rgba(248,81,73,0.22);
  --rp-ie-danger-fg: #FDA29B;
  --rp-ie-danger-border: rgba(248,81,73,0.35);

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--rp-ie-surface-0);
  color: var(--rp-ie-text);
  font-family: -apple-system, "Inter", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.35;
  overflow: hidden;
  border-radius: var(--rp-ie-radius-lg);
  border: 1px solid var(--rp-ie-border);
  box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 24px 80px rgba(0,0,0,0.35);
}

.rp-ie-root[data-theme="light"] {
  --rp-ie-surface-0: #F7F8FA;
  --rp-ie-surface-1: #FFFFFF;
  --rp-ie-surface-2: #F1F3F7;
  --rp-ie-border: rgba(15,20,30,0.08);
  --rp-ie-text: #12151C;
  --rp-ie-text-muted: #5B6472;
  color-scheme: light;

  /* Light-mode component tokens. Base rules reference these vars so
   * they automatically pick up the light palette — no per-theme rule
   * duplication or specificity fights needed. */
  --rp-ie-track: rgba(15,20,30,0.22);
  --rp-ie-track-center: rgba(15,20,30,0.45);
  --rp-ie-thumb-border: #FFFFFF;
  --rp-ie-thumb-shadow: 0 1px 3px rgba(15,20,30,0.28);
  --rp-ie-danger-bg: rgba(217,45,32,0.10);
  --rp-ie-danger-bg-hover: rgba(217,45,32,0.18);
  --rp-ie-danger-fg: #B42318;
  --rp-ie-danger-border: rgba(217,45,32,0.35);
}

.rp-ie-root * { box-sizing: border-box; }

.rp-ie-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  color: currentColor;
}
.rp-ie-icon svg { width: 100%; height: 100%; display: block; }
.rp-ie-icon--sm { width: 14px; height: 14px; }
.rp-ie-icon--xl { width: 56px; height: 56px; }

/* Themed scrollbars — keep the shell chrome consistent with the accent
 * palette on both WebKit (Chromium / Safari) and Firefox. Applied to the
 * root so any scrollable region inside the editor picks it up. */
.rp-ie-root { scrollbar-width: thin; scrollbar-color: rgba(var(--rp-ie-accent-rgb), 0.55) transparent; }
.rp-ie-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.rp-ie-root ::-webkit-scrollbar-track { background: transparent; }
.rp-ie-root ::-webkit-scrollbar-thumb {
  background: rgba(var(--rp-ie-accent-rgb), 0.45);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.rp-ie-root ::-webkit-scrollbar-thumb:hover { background: rgba(var(--rp-ie-accent-rgb), 0.7); background-clip: padding-box; border: 2px solid transparent; }
.rp-ie-root ::-webkit-scrollbar-corner { background: transparent; }


.rp-ie-sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

/* Top bar */
.rp-ie-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--rp-ie-surface-1);
  border-bottom: 1px solid var(--rp-ie-border);
  flex-shrink: 0;
}
.rp-ie-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rp-ie-brand__badge {
  width: var(--rp-ie-brand-badge-size, 40px);
  height: var(--rp-ie-brand-badge-size, 40px);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(var(--rp-ie-accent-rgb), 0.15), rgba(var(--rp-ie-accent-rgb), 0.05));
  color: var(--rp-ie-accent);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--rp-ie-border);
}
.rp-ie-brand__badge .rp-ie-icon { width: var(--rp-ie-brand-logo-size, 22px); height: var(--rp-ie-brand-logo-size, 22px); }
.rp-ie-brand__logo {
  width: var(--rp-ie-brand-logo-size, 24px);
  height: var(--rp-ie-brand-logo-size, 24px);
  object-fit: contain;
  display: block;
  border-radius: 4px;
}
.rp-ie-brand__titles { display: flex; flex-direction: column; min-width: 0; }
.rp-ie-brand__title {
  font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--rp-ie-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-ie-brand__subtitle {
  font-size: 12px; color: var(--rp-ie-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-ie-topbar__spacer { flex: 1; }
.rp-ie-image-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 32px;
  padding: 0 10px;
  margin-right: 8px;
  border-radius: 999px;
  border: 1px solid var(--rp-ie-border);
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text-muted);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.rp-ie-topbar__actions { display: flex; align-items: center; gap: 6px; }

.rp-ie-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid transparent;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  padding: 0;
  transition: background 160ms cubic-bezier(0.2,0.8,0.2,1), border-color 160ms;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-iconbtn:hover:not([disabled]) {
  background: var(--rp-ie-surface-2);
  border-color: var(--rp-ie-border);
}
.rp-ie-iconbtn:focus-visible {
  outline: 2px solid var(--rp-ie-accent);
  outline-offset: 2px;
}
.rp-ie-iconbtn[disabled], .rp-ie-disabled {
  opacity: 0.4; cursor: not-allowed;
}

.rp-ie-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  font: inherit; font-weight: 500;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 160ms cubic-bezier(0.2,0.8,0.2,1), transform 160ms;
  -webkit-tap-highlight-color: transparent;
  height: 36px;
}
.rp-ie-btn:focus-visible {
  outline: 2px solid var(--rp-ie-accent);
  outline-offset: 2px;
}
.rp-ie-btn--primary {
  background: var(--rp-ie-cta);
  color: var(--rp-ie-cta-text);
  border-color: var(--rp-ie-cta);
}
.rp-ie-btn--primary:hover { filter: brightness(1.08); }
.rp-ie-btn--ghost {
  background: transparent;
  color: var(--rp-ie-text);
  border-color: var(--rp-ie-border);
}
.rp-ie-btn--ghost:hover { background: var(--rp-ie-surface-2); }
.rp-ie-btn--danger {
  background: var(--rp-ie-danger-bg);
  color: var(--rp-ie-danger-fg);
  border-color: var(--rp-ie-danger-border);
}
.rp-ie-btn--danger:hover { background: var(--rp-ie-danger-bg-hover); }
.rp-ie-btn--sm { height: 32px; padding: 6px 12px; font-size: 13px; }

.rp-ie-zoom-trigger { position: relative; }
.rp-ie-zoom-btn { padding: 8px 10px; font-variant-numeric: tabular-nums; min-width: 88px; justify-content: space-between; }
.rp-ie-menu {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: var(--rp-ie-surface-1);
  border: 1px solid var(--rp-ie-border);
  border-radius: var(--rp-ie-radius);
  box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  padding: 4px;
  min-width: 140px;
  z-index: 20;
}
.rp-ie-menu__item {
  display: block; width: 100%;
  background: transparent; color: var(--rp-ie-text);
  border: none; text-align: left;
  padding: 8px 10px; font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.rp-ie-menu__item:hover { background: var(--rp-ie-surface-2); }

/* Middle row */
.rp-ie-middle {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 92px 260px 1fr 92px;
  gap: 0;
  background: var(--rp-ie-surface-0);
}

.rp-ie-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  background: var(--rp-ie-surface-1);
  border-right: 1px solid var(--rp-ie-border);
  overflow-y: auto;
}
.rp-ie-rail--right {
  border-right: none;
  border-left: 1px solid var(--rp-ie-border);
  align-items: center;
}

.rp-ie-tile {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 64px;
  padding: 8px 6px;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid transparent;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  transition: background 160ms cubic-bezier(0.2,0.8,0.2,1), border-color 160ms, color 160ms;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-tile:hover:not([disabled]) { background: var(--rp-ie-surface-2); }
.rp-ie-tile:focus-visible { outline: 2px solid var(--rp-ie-accent); outline-offset: 2px; }
.rp-ie-tile--active {
  background: rgba(var(--rp-ie-accent-rgb), 0.14);
  color: var(--rp-ie-text);
  border-color: rgba(var(--rp-ie-accent-rgb), 0.45);
  box-shadow: inset 2px 0 0 var(--rp-ie-accent);
}
.rp-ie-tile__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--rp-ie-text-muted);
  letter-spacing: 0.02em;
}
.rp-ie-tile--soon { cursor: not-allowed; }
.rp-ie-tile--compact { min-height: 56px; width: 72px; }
.rp-ie-pill {
  position: absolute; top: 4px; right: 4px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.08em;
  padding: 2px 6px;
  background: rgba(255,255,255,0.08);
  color: var(--rp-ie-text-muted);
  border-radius: 999px;
  text-transform: uppercase;
}

/* Properties panel */
.rp-ie-props {
  display: flex; flex-direction: column;
  padding: 16px;
  gap: 16px;
  overflow-y: auto;
  background: var(--rp-ie-surface-1);
  border-right: 1px solid var(--rp-ie-border);
}
.rp-ie-props__header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 15px; font-weight: 600;
  color: var(--rp-ie-text);
  margin-bottom: 4px;
}
.rp-ie-props__body { display: flex; flex-direction: column; gap: 14px; }
.rp-ie-props__label {
  font-size: 12px; font-weight: 500;
  color: var(--rp-ie-text-muted);
  letter-spacing: 0.02em;
}
.rp-ie-props__label--sub { margin-top: 4px; }
.rp-ie-props__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.rp-ie-hint {
  font-size: 12px;
  color: var(--rp-ie-text-muted);
  line-height: 1.5;
}

.rp-ie-slider { display: flex; flex-direction: column; gap: 6px; }
.rp-ie-slider__row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px;
}
.rp-ie-slider__label { color: var(--rp-ie-text); font-weight: 500; }
.rp-ie-slider__value { color: var(--rp-ie-text-muted); font-variant-numeric: tabular-nums; }

.rp-ie-range {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
  cursor: pointer;
  height: 20px;
  margin: 0;
}
.rp-ie-range::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--rp-ie-track);
  border-radius: 999px;
}
.rp-ie-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--rp-ie-accent);
  margin-top: -6px;
  border: 2px solid var(--rp-ie-thumb-border);
  box-shadow: var(--rp-ie-thumb-shadow);
}
.rp-ie-range::-moz-range-track {
  height: 4px;
  background: var(--rp-ie-track);
  border-radius: 999px;
}
.rp-ie-range::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--rp-ie-accent);
  border: 2px solid var(--rp-ie-thumb-border);
  box-shadow: var(--rp-ie-thumb-shadow);
}

.rp-ie-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rp-ie-chip {
  padding: 6px 10px;
  border: 1px solid var(--rp-ie-border);
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-chip:hover { border-color: var(--rp-ie-accent); }
.rp-ie-chip--active {
  background: var(--rp-ie-accent);
  color: var(--rp-ie-accent-contrast);
  border-color: var(--rp-ie-accent);
}

.rp-ie-color-section { display: flex; flex-direction: column; gap: 8px; }
.rp-ie-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.rp-ie-swatch {
  width: 100%;
  aspect-ratio: 1 / 1;
  min-height: 32px;
  border-radius: 50%;
  border: 2px solid var(--rp-ie-border);
  background: var(--swatch-color);
  padding: 0;
  cursor: pointer;
  transition: transform 160ms, border-color 160ms;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-swatch:hover { transform: scale(1.05); }
.rp-ie-swatch--active {
  border-color: var(--rp-ie-accent);
  box-shadow: 0 0 0 2px var(--rp-ie-surface-1), 0 0 0 4px var(--rp-ie-accent);
}
.rp-ie-custom-color {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--rp-ie-border);
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text);
  border-radius: var(--rp-ie-radius);
  font-size: 13px;
  cursor: pointer;
  align-self: flex-start;
  position: relative;
}
.rp-ie-custom-color:hover { border-color: var(--rp-ie-accent); }
.rp-ie-custom-color__input {
  position: absolute; inset: 0;
  opacity: 0; cursor: pointer;
}

.rp-ie-shape-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.rp-ie-shape-tile {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 6px;
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text);
  border: 1px solid var(--rp-ie-border);
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-shape-tile__label { font-size: 11px; color: var(--rp-ie-text-muted); }
.rp-ie-shape-tile:hover { border-color: var(--rp-ie-accent); }
.rp-ie-shape-tile--active {
  border-color: var(--rp-ie-accent);
  background: rgba(var(--rp-ie-accent-rgb), 0.14);
}

/* Filter preset grid */
.rp-ie-filter-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.rp-ie-filter-tile {
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
  padding: 6px;
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text);
  border: 1px solid var(--rp-ie-border);
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 120ms ease, background 120ms ease;
}
.rp-ie-filter-tile:hover { border-color: var(--rp-ie-accent); }
.rp-ie-filter-tile--active {
  border-color: var(--rp-ie-accent);
  background: rgba(var(--rp-ie-accent-rgb), 0.14);
}
.rp-ie-filter-tile__label {
  font-size: 11px;
  color: var(--rp-ie-text-muted);
  text-align: center;
}
.rp-ie-filter-swatch {
  display: block;
  width: 100%;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--rp-ie-border);
  background:
    linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6a11cb 100%);
}
.rp-ie-filter-swatch--none {
  background: linear-gradient(135deg, #7ea3ff 0%, #fca5a5 50%, #86efac 100%);
}
.rp-ie-filter-swatch--grayscale {
  background: linear-gradient(135deg, #3f3f3f 0%, #a3a3a3 50%, #e5e5e5 100%);
}
.rp-ie-filter-swatch--sepia {
  background: linear-gradient(135deg, #5c3b1e 0%, #b48453 50%, #f2d5a7 100%);
}
.rp-ie-filter-swatch--vintage {
  background: linear-gradient(135deg, #6d4b34 0%, #d1a26a 50%, #f7e2b7 100%);
  filter: contrast(0.9) saturate(0.85);
}
.rp-ie-filter-swatch--cool {
  background: linear-gradient(135deg, #1e3a8a 0%, #38bdf8 55%, #a5f3fc 100%);
}
.rp-ie-filter-swatch--warm {
  background: linear-gradient(135deg, #b45309 0%, #f59e0b 55%, #fde68a 100%);
}
.rp-ie-filter-swatch--invert {
  background: linear-gradient(135deg, #f8fafc 0%, #64748b 50%, #0f172a 100%);
}

/* Bipolar range — thin center tick to signal "0" */
.rp-ie-range--bipolar {
  background: linear-gradient(
    to right,
    var(--rp-ie-track) 0%,
    var(--rp-ie-track) calc(50% - 1px),
    var(--rp-ie-track-center) calc(50% - 1px),
    var(--rp-ie-track-center) calc(50% + 1px),
    var(--rp-ie-track) calc(50% + 1px),
    var(--rp-ie-track) 100%
  );
}

/* Stage */
.rp-ie-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, rgba(0,0,0,0) 25% 50%) 0 0 / 24px 24px,
    var(--rp-ie-surface-0);
  min-height: 0;
  overflow: hidden;
}
.rp-ie-stage__slot {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--rp-ie-radius-lg);
  border: 1px solid var(--rp-ie-border);
  background:
    repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, rgba(0,0,0,0) 25% 50%) 0 0 / 20px 20px,
    var(--rp-ie-surface-1);
  overflow: hidden;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}
.rp-ie-empty {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: var(--rp-ie-text-muted);
  padding: 32px;
  text-align: center;
}
.rp-ie-empty__illustration {
  width: 96px; height: 96px;
  border-radius: 20px;
  background: var(--rp-ie-surface-2);
  border: 1px solid var(--rp-ie-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--rp-ie-accent);
}
.rp-ie-empty__title {
  font-size: 15px; font-weight: 500; color: var(--rp-ie-text);
}
.rp-ie-empty__subtitle { font-size: 12px; }

.rp-ie-loader {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(11,13,18,0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 40;
}
.rp-ie-loader__glass {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  background: rgba(24,28,37,0.9);
  border: 1px solid var(--rp-ie-border);
  border-radius: var(--rp-ie-radius);
  color: var(--rp-ie-text);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  font-size: 13px;
}
.rp-ie-loader__spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: var(--rp-ie-accent);
  animation: rp-editor-spin 0.8s linear infinite;
}
@keyframes rp-editor-spin { to { transform: rotate(360deg); } }

/* Bottom bar */
.rp-ie-bottombar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 16px;
  background: var(--rp-ie-surface-1);
  border-top: 1px solid var(--rp-ie-border);
  flex-shrink: 0;
}
.rp-ie-bottombar__section {
  display: flex; align-items: center; gap: 12px; min-width: 0;
}
.rp-ie-bottombar__label {
  font-size: 12px; color: var(--rp-ie-text-muted);
  padding-right: 12px;
  border-right: 1px solid var(--rp-ie-border);
}
.rp-ie-quickactions {
  display: flex; align-items: center; gap: 4px;
  overflow-x: auto;
}
.rp-ie-quickaction {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 6px 10px;
  min-width: 56px;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid transparent;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 160ms cubic-bezier(0.2,0.8,0.2,1);
}
.rp-ie-quickaction:hover { background: var(--rp-ie-surface-2); }
.rp-ie-quickaction__label { font-size: 11px; color: var(--rp-ie-text-muted); }
.rp-ie-quickaction--active {
  background: rgba(var(--rp-ie-accent-rgb), 0.14);
  border-color: rgba(var(--rp-ie-accent-rgb), 0.45);
}
.rp-ie-quickaction:focus-visible { outline: 2px solid var(--rp-ie-accent); outline-offset: 2px; }

.rp-ie-bottombar__slider {
  flex: 1;
  display: flex; align-items: center; gap: 12px;
  padding-left: 24px;
  margin-left: auto;
  max-width: 380px;
}
.rp-ie-bottombar__slider .rp-ie-range { flex: 1; }

/* Toast */
.rp-ie-toast-root {
  position: absolute;
  right: 16px; bottom: 88px;
  display: flex; flex-direction: column; gap: 8px;
  z-index: 50;
  pointer-events: none;
}
.rp-ie-toast {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--rp-ie-surface-2);
  color: var(--rp-ie-text);
  border-radius: var(--rp-ie-radius);
  border: 1px solid var(--rp-ie-border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  font-size: 13px;
  pointer-events: auto;
  max-width: 360px;
}
.rp-ie-toast--error {
  border-color: rgba(248,81,73,0.4);
  color: #FDA29B;
}
.rp-ie-toast-close {
  background: transparent; border: none;
  color: currentColor; cursor: pointer; padding: 0;
  width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
}

/* Responsive */
@media (max-width: 1024px) {
  .rp-ie-middle {
    grid-template-columns: 84px 240px 1fr;
  }
  .rp-ie-rail--right { display: none; }
}

@media (max-width: 768px) {
  .rp-ie-middle {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }
  .rp-ie-rail--left {
    flex-direction: row;
    width: 100%;
    padding: 8px 12px;
    border-right: none;
    border-bottom: 1px solid var(--rp-ie-border);
    overflow-x: auto;
  }
  .rp-ie-tile {
    width: 72px;
    min-width: 72px;
    min-height: 56px;
  }
  .rp-ie-props {
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid var(--rp-ie-border);
  }
  .rp-ie-brand__subtitle { display: none; }
  .rp-ie-topbar { padding: 10px 12px; gap: 8px; }
  .rp-ie-btn span:not(.rp-ie-icon) { display: none; }
  .rp-ie-btn { padding: 8px 10px; }
  .rp-ie-bottombar__slider { display: none !important; }
}

@media (max-width: 480px) {
  .rp-ie-modal { height: 100vh; border-radius: 0; }
  .rp-ie-modal-backdrop, .rp-editor-modal-backdrop { padding: 0; }
  .rp-ie-root { border-radius: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rp-ie-btn, .rp-ie-tile, .rp-ie-quickaction, .rp-ie-iconbtn,
  .rp-ie-loader__spinner, .rp-ie-swatch {
    transition: none !important; animation: none !important;
  }
}

/* Legacy suppression — old inline toolbar rows no longer render */
.rp-editor-toolbar-container { display: none; }
`;

/**
 * Idempotently inject the shell stylesheet into the document. Called
 * from RpImageEditor's constructor so the IIFE bundle "just works"
 * without a separate CSS import.
 */
export function ensureShellStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('rp-ie-shell-styles')) return;
  const style = document.createElement('style');
  style.id = 'rp-ie-shell-styles';
  style.textContent = RP_IE_CSS;
  document.head.appendChild(style);
}
