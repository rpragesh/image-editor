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
  --rp-ie-border: rgba(255,255,255,0.07);
  --rp-ie-border-strong: rgba(255,255,255,0.14);
  --rp-ie-text: #ECEEF3;
  --rp-ie-text-muted: #8A93A6;
  --rp-ie-accent: #2f6feb;
  --rp-ie-accent-rgb: 47, 111, 235;
  --rp-ie-accent-contrast: #FFFFFF;
  --rp-ie-cta: var(--rp-ie-accent);
  --rp-ie-cta-text: var(--rp-ie-accent-contrast);
  --rp-ie-focus: #6EA0FF;
  --rp-ie-radius: 10px;
  --rp-ie-radius-sm: 8px;
  --rp-ie-radius-lg: 16px;
  --rp-ie-danger: #F85149;
  --rp-ie-success: #3FB950;
  --rp-ie-warning: #D29922;
  --rp-ie-topbar-h: 56px;

  /* Theme-aware component tokens, overridden per variant below. */
  --rp-ie-track: rgba(255,255,255,0.14);
  --rp-ie-track-center: rgba(255,255,255,0.35);
  --rp-ie-thumb-border: var(--rp-ie-surface-1);
  --rp-ie-thumb-shadow: 0 1px 4px rgba(0,0,0,0.4);
  --rp-ie-swatch-ring: rgba(255,255,255,0.32);
  --rp-ie-hover: rgba(255,255,255,0.06);
  --rp-ie-danger-bg: rgba(248,81,73,0.14);
  --rp-ie-danger-bg-hover: rgba(248,81,73,0.22);
  --rp-ie-danger-fg: #FDA29B;
  --rp-ie-danger-border: rgba(248,81,73,0.35);

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--rp-ie-surface-0);
  color: var(--rp-ie-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  border-radius: var(--rp-ie-radius-lg);
  border: 1px solid var(--rp-ie-border);
}

.rp-ie-root[data-theme="light"] {
  --rp-ie-surface-0: #F3F4F7;
  --rp-ie-surface-1: #FFFFFF;
  --rp-ie-surface-2: #F1F3F7;
  --rp-ie-border: rgba(15,20,30,0.09);
  --rp-ie-border-strong: rgba(15,20,30,0.18);
  --rp-ie-text: #12151C;
  --rp-ie-text-muted: #5B6472;
  --rp-ie-focus: #1D4ED8;
  color-scheme: light;

  --rp-ie-track: rgba(15,20,30,0.18);
  --rp-ie-track-center: rgba(15,20,30,0.45);
  --rp-ie-thumb-border: #FFFFFF;
  --rp-ie-thumb-shadow: 0 1px 3px rgba(15,20,30,0.28);
  --rp-ie-swatch-ring: rgba(15,20,30,0.30);
  --rp-ie-hover: rgba(15,20,30,0.05);
  --rp-ie-danger-bg: rgba(217,45,32,0.10);
  --rp-ie-danger-bg-hover: rgba(217,45,32,0.18);
  --rp-ie-danger-fg: #B42318;
  --rp-ie-danger-border: rgba(217,45,32,0.35);
}

.rp-ie-root * { box-sizing: border-box; }
.rp-ie-root [hidden] { display: none !important; }

/* One visible focus style for every control. */
.rp-ie-root :is(button, input, select, textarea, a, [tabindex]):focus-visible {
  outline: 2px solid var(--rp-ie-focus);
  outline-offset: 2px;
}
.rp-ie-custom-color:focus-within { outline: 2px solid var(--rp-ie-focus); outline-offset: 2px; }

.rp-ie-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: currentColor;
}
.rp-ie-icon svg { width: 100%; height: 100%; display: block; }
.rp-ie-icon--sm { width: 14px; height: 14px; }
.rp-ie-icon--xl { width: 56px; height: 56px; }

.rp-ie-root { scrollbar-width: thin; scrollbar-color: var(--rp-ie-border-strong) transparent; }
.rp-ie-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.rp-ie-root ::-webkit-scrollbar-track { background: transparent; }
.rp-ie-root ::-webkit-scrollbar-thumb {
  background: var(--rp-ie-border-strong);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.rp-ie-root ::-webkit-scrollbar-corner { background: transparent; }

.rp-ie-sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

/* ── Top bar ─────────────────────────────────────────────────── */
.rp-ie-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  height: var(--rp-ie-topbar-h);
  padding: 0 12px;
  background: var(--rp-ie-surface-1);
  border-bottom: 1px solid var(--rp-ie-border);
  flex-shrink: 0;
}
.rp-ie-topbar__group { display: flex; align-items: center; gap: 4px; min-width: 0; }
.rp-ie-topbar__group--start { justify-content: flex-start; }
.rp-ie-topbar__group--center { justify-content: center; }
.rp-ie-topbar__group--end { justify-content: flex-end; gap: 8px; }
.rp-ie-topbar__cluster { display: flex; align-items: center; gap: 2px; }
.rp-ie-topbar__cluster + .rp-ie-topbar__cluster,
.rp-ie-topbar__cluster + .rp-ie-iconbtn {
  padding-left: 8px;
  border-left: 1px solid var(--rp-ie-border);
}
.rp-ie-close { margin-right: 4px; }

.rp-ie-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.rp-ie-brand__badge {
  width: var(--rp-ie-brand-badge-size, 32px);
  height: var(--rp-ie-brand-badge-size, 32px);
  border-radius: 8px;
  background: rgba(var(--rp-ie-accent-rgb), 0.12);
  color: var(--rp-ie-accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rp-ie-brand__badge .rp-ie-icon { width: var(--rp-ie-brand-logo-size, 20px); height: var(--rp-ie-brand-logo-size, 20px); }
.rp-ie-brand__logo {
  width: var(--rp-ie-brand-logo-size, 22px);
  height: var(--rp-ie-brand-logo-size, 22px);
  object-fit: contain;
  display: block;
  border-radius: 4px;
}
.rp-ie-brand__titles { display: flex; flex-direction: column; min-width: 0; }
.rp-ie-brand__title {
  font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--rp-ie-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-ie-brand__subtitle {
  font-size: 12px; color: var(--rp-ie-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-ie-image-counter {
  padding: 0 8px;
  color: var(--rp-ie-text);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Buttons ─────────────────────────────────────────────────── */
.rp-ie-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  flex-shrink: 0;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid transparent;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  padding: 0;
  transition: background-color 140ms ease, border-color 140ms ease;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-iconbtn:hover:not([disabled]) { background: var(--rp-ie-hover); }
.rp-ie-iconbtn:active:not([disabled]) { background: var(--rp-ie-border-strong); }
.rp-ie-iconbtn[disabled], .rp-ie-disabled { opacity: 0.38; cursor: not-allowed; }
.rp-ie-iconbtn--outline {
  width: 100%; height: 44px;
  border-color: var(--rp-ie-border-strong);
}

.rp-ie-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 36px;
  padding: 0 14px;
  font: inherit; font-size: 14px; font-weight: 500;
  white-space: nowrap;
  border-radius: var(--rp-ie-radius);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 140ms ease, filter 140ms ease;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-btn--primary {
  background: var(--rp-ie-cta);
  color: var(--rp-ie-cta-text);
  border-color: var(--rp-ie-cta);
  font-weight: 600;
}
.rp-ie-btn--primary:hover { filter: brightness(1.1); }
.rp-ie-btn--primary:active { filter: brightness(0.95); }
.rp-ie-btn--ghost {
  background: transparent;
  color: var(--rp-ie-text);
  border-color: var(--rp-ie-border-strong);
}
.rp-ie-btn--ghost:hover { background: var(--rp-ie-hover); }
.rp-ie-btn--danger {
  background: var(--rp-ie-danger-bg);
  color: var(--rp-ie-danger-fg);
  border-color: var(--rp-ie-danger-border);
}
.rp-ie-btn--danger:hover { background: var(--rp-ie-danger-bg-hover); }
.rp-ie-btn--sm { height: 36px; padding: 0 12px; font-size: 13px; }
.rp-ie-apply { padding: 0 16px; }

.rp-ie-zoom-trigger { position: relative; }
.rp-ie-zoom-btn {
  height: 36px; min-width: 64px;
  padding: 0 6px 0 10px; gap: 2px;
  border-color: transparent;
  font-variant-numeric: tabular-nums; font-size: 13px;
  color: var(--rp-ie-text);
}
.rp-ie-menu {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: var(--rp-ie-surface-1);
  border: 1px solid var(--rp-ie-border-strong);
  border-radius: var(--rp-ie-radius);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
  padding: 4px;
  min-width: 132px;
  z-index: 20;
}
.rp-ie-menu__item {
  display: block; width: 100%;
  background: transparent; color: var(--rp-ie-text);
  border: none; text-align: left;
  padding: 8px 10px; font: inherit; font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.rp-ie-menu__item:hover { background: var(--rp-ie-hover); }

/* ── Middle: rail · panel · stage ────────────────────────────── */
.rp-ie-middle {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 76px 288px minmax(0, 1fr);
  background: var(--rp-ie-surface-0);
}
.rp-ie-middle--no-props { grid-template-columns: 76px minmax(0, 1fr); }

.rp-ie-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  background: var(--rp-ie-surface-1);
  border-right: 1px solid var(--rp-ie-border);
  overflow-y: auto;
  scrollbar-width: none;
}
.rp-ie-rail::-webkit-scrollbar { display: none; }

.rp-ie-tile {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  width: 64px;
  min-height: 56px;
  flex-shrink: 0;
  padding: 6px 4px;
  background: transparent;
  color: var(--rp-ie-text-muted);
  border: 1px solid transparent;
  border-radius: var(--rp-ie-radius);
  font: inherit;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-tile:hover:not([disabled]) { background: var(--rp-ie-hover); color: var(--rp-ie-text); }
.rp-ie-tile--active,
.rp-ie-tile--active:hover:not([disabled]) {
  background: rgba(var(--rp-ie-accent-rgb), 0.16);
  border-color: rgba(var(--rp-ie-accent-rgb), 0.55);
  color: var(--rp-ie-text);
}
.rp-ie-tile__label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  color: inherit;
  text-align: center;
  white-space: nowrap;
}
.rp-ie-tile--active .rp-ie-tile__label { font-weight: 600; }
.rp-ie-tile--soon { cursor: not-allowed; }
.rp-ie-pill {
  position: absolute; top: 4px; right: 4px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.08em;
  padding: 2px 6px;
  background: var(--rp-ie-hover);
  color: var(--rp-ie-text-muted);
  border-radius: 999px;
  text-transform: uppercase;
}

/* Properties panel */
.rp-ie-props {
  display: flex; flex-direction: column;
  padding: 18px;
  gap: 16px;
  min-width: 0;
  overflow-y: auto;
  background: var(--rp-ie-surface-1);
  border-right: 1px solid var(--rp-ie-border);
}
.rp-ie-props__header {
  margin: 0;
  font-size: 15px; font-weight: 600; line-height: 1.3;
  color: var(--rp-ie-text);
}
.rp-ie-props__body { display: flex; flex-direction: column; gap: 16px; }
.rp-ie-props__label {
  font-size: 12px; font-weight: 500;
  color: var(--rp-ie-text-muted);
  margin-bottom: -8px;
}
.rp-ie-props__label--sub { margin-top: 2px; }
.rp-ie-props__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rp-ie-props__actions .rp-ie-btn--primary { flex: 1; }
.rp-ie-hint {
  margin: 0;
  font-size: 12px;
  color: var(--rp-ie-text-muted);
  line-height: 1.5;
}
.rp-ie-transform-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.rp-ie-slider { display: flex; flex-direction: column; gap: 6px; }
.rp-ie-slider__row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px;
}
.rp-ie-slider__label { color: var(--rp-ie-text-muted); font-size: 12px; font-weight: 500; }
.rp-ie-slider__value { color: var(--rp-ie-text); font-size: 12px; font-variant-numeric: tabular-nums; }

.rp-ie-range {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
  cursor: pointer;
  height: 24px;
  margin: 0;
}
.rp-ie-range::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--rp-ie-track);
  border-radius: 999px;
}
.rp-ie-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--rp-ie-accent);
  margin-top: -7px;
  border: 2px solid var(--rp-ie-thumb-border);
  box-shadow: var(--rp-ie-thumb-shadow);
}
.rp-ie-range::-moz-range-track {
  height: 4px;
  background: var(--rp-ie-track);
  border-radius: 999px;
}
.rp-ie-range::-moz-range-thumb {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--rp-ie-accent);
  border: 2px solid var(--rp-ie-thumb-border);
  box-shadow: var(--rp-ie-thumb-shadow);
}
.rp-ie-range--bipolar {
  background: linear-gradient(
    to right,
    transparent 0%,
    transparent calc(50% - 1px),
    var(--rp-ie-track-center) calc(50% - 1px),
    var(--rp-ie-track-center) calc(50% + 1px),
    transparent calc(50% + 1px),
    transparent 100%
  ) center / 100% 12px no-repeat;
}

.rp-ie-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.rp-ie-chip {
  height: 36px;
  padding: 0 6px;
  border: 1px solid var(--rp-ie-border-strong);
  background: transparent;
  color: var(--rp-ie-text);
  border-radius: var(--rp-ie-radius-sm);
  font: inherit; font-size: 12px; font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-chip:hover { background: var(--rp-ie-hover); }
.rp-ie-chip--active,
.rp-ie-chip--active:hover {
  background: var(--rp-ie-accent);
  color: var(--rp-ie-accent-contrast);
  border-color: var(--rp-ie-accent);
}

.rp-ie-color-section { display: flex; flex-direction: column; gap: 16px; }
.rp-ie-color-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
.rp-ie-swatch {
  width: 100%;
  aspect-ratio: 1 / 1;
  min-height: 28px;
  border-radius: 50%;
  border: 1px solid var(--rp-ie-swatch-ring);
  background: var(--swatch-color);
  padding: 0;
  cursor: pointer;
  transition: transform 140ms ease;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-swatch:hover { transform: scale(1.08); }
.rp-ie-swatch--active {
  box-shadow: 0 0 0 2px var(--rp-ie-surface-1), 0 0 0 4px var(--rp-ie-accent);
}
.rp-ie-custom-color {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--rp-ie-border-strong);
  background: transparent;
  color: var(--rp-ie-text);
  border-radius: var(--rp-ie-radius);
  font-size: 13px;
  cursor: pointer;
  align-self: flex-start;
  position: relative;
}
.rp-ie-custom-color:hover { background: var(--rp-ie-hover); }
.rp-ie-custom-color__input {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  opacity: 0; cursor: pointer;
}

.rp-ie-shape-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.rp-ie-shape-tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-height: 56px;
  padding: 8px 4px;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid var(--rp-ie-border-strong);
  border-radius: var(--rp-ie-radius);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.rp-ie-shape-tile__label { font-size: 11px; color: var(--rp-ie-text-muted); }
.rp-ie-shape-tile:hover { background: var(--rp-ie-hover); }
.rp-ie-shape-tile--active,
.rp-ie-shape-tile--active:hover {
  border-color: var(--rp-ie-accent);
  background: rgba(var(--rp-ie-accent-rgb), 0.16);
}
.rp-ie-shape-tile--active .rp-ie-shape-tile__label { color: var(--rp-ie-text); }

/* Filter presets: live previews of the photo */
.rp-ie-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.rp-ie-filter-tile {
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
  padding: 4px 4px 6px;
  background: transparent;
  color: var(--rp-ie-text);
  border: 1px solid var(--rp-ie-border-strong);
  border-radius: var(--rp-ie-radius);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 140ms ease, background-color 140ms ease;
}
.rp-ie-filter-tile:hover { background: var(--rp-ie-hover); }
.rp-ie-filter-tile--active,
.rp-ie-filter-tile--active:hover {
  border-color: var(--rp-ie-accent);
  background: rgba(var(--rp-ie-accent-rgb), 0.14);
}
.rp-ie-filter-tile__label {
  font-size: 12px;
  color: var(--rp-ie-text);
  text-align: center;
}
.rp-ie-filter-preview,
.rp-ie-filter-swatch {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 7px;
  object-fit: cover;
}
.rp-ie-filter-swatch { background: linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6a11cb 100%); }
.rp-ie-filter-swatch--none { background: linear-gradient(135deg, #7ea3ff 0%, #fca5a5 50%, #86efac 100%); }
.rp-ie-filter-swatch--grayscale { background: linear-gradient(135deg, #3f3f3f 0%, #a3a3a3 50%, #e5e5e5 100%); }
.rp-ie-filter-swatch--sepia { background: linear-gradient(135deg, #5c3b1e 0%, #b48453 50%, #f2d5a7 100%); }
.rp-ie-filter-swatch--vintage { background: linear-gradient(135deg, #6d4b34 0%, #d1a26a 50%, #f7e2b7 100%); }
.rp-ie-filter-swatch--cool { background: linear-gradient(135deg, #1e3a8a 0%, #38bdf8 55%, #a5f3fc 100%); }
.rp-ie-filter-swatch--warm { background: linear-gradient(135deg, #b45309 0%, #f59e0b 55%, #fde68a 100%); }
.rp-ie-filter-swatch--invert { background: linear-gradient(135deg, #f8fafc 0%, #64748b 50%, #0f172a 100%); }

/* ── Stage: the photo, one frame ─────────────────────────────── */
.rp-ie-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--rp-ie-surface-0);
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.rp-ie-stage__slot {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}
.rp-ie-empty {
  margin: auto;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: var(--rp-ie-text-muted);
  padding: 32px;
  text-align: center;
}
.rp-ie-empty__illustration {
  width: 88px; height: 88px;
  border-radius: 20px;
  background: var(--rp-ie-surface-1);
  border: 1px solid var(--rp-ie-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--rp-ie-accent);
}
.rp-ie-empty__title { font-size: 15px; font-weight: 500; color: var(--rp-ie-text); }
.rp-ie-empty__subtitle { font-size: 12px; }

.rp-ie-loader {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(11,13,18,0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 40;
}
.rp-ie-loader__glass {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: var(--rp-ie-surface-1);
  border: 1px solid var(--rp-ie-border-strong);
  border-radius: var(--rp-ie-radius);
  color: var(--rp-ie-text);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  font-size: 13px;
}
.rp-ie-loader__spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--rp-ie-border-strong);
  border-top-color: var(--rp-ie-accent);
  animation: rp-editor-spin 0.8s linear infinite;
}
@keyframes rp-editor-spin { to { transform: rotate(360deg); } }

/* Toast */
.rp-ie-toast-root {
  position: absolute;
  right: 16px; bottom: 16px;
  display: flex; flex-direction: column; gap: 8px;
  z-index: 50;
  pointer-events: none;
}
.rp-ie-toast {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--rp-ie-surface-1);
  color: var(--rp-ie-text);
  border-radius: var(--rp-ie-radius);
  border: 1px solid var(--rp-ie-border-strong);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
  font-size: 13px;
  pointer-events: auto;
  max-width: 360px;
}
.rp-ie-toast--error { border-color: var(--rp-ie-danger-border); color: var(--rp-ie-danger-fg); }
.rp-ie-toast-close {
  background: transparent; border: none;
  color: currentColor; cursor: pointer; padding: 0;
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
}

/* ── Tablet ──────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  /* The actions need their full width here; the counter sits beside them. */
  .rp-ie-topbar { grid-template-columns: minmax(0, 1fr) auto auto; }
  .rp-ie-middle { grid-template-columns: 72px 248px minmax(0, 1fr); }
  .rp-ie-middle--no-props { grid-template-columns: 72px minmax(0, 1fr); }
  .rp-ie-tile { width: 60px; }
}

/* ── Phone: tools at the bottom, settings as a sheet above ─────── */
@media (max-width: 640px) {
  .rp-ie-topbar {
    display: flex;
    gap: 4px;
    padding: 0 4px;
  }
  .rp-ie-topbar__group--start { flex: 1 1 auto; }
  .rp-ie-topbar__group--center { flex: 0 0 auto; }
  .rp-ie-topbar__group--end { flex: 0 0 auto; gap: 4px; }
  /* With an image counter, the counter takes the title's place. */
  .rp-ie-topbar:has(.rp-ie-image-counter) .rp-ie-brand { display: none; }
  .rp-ie-close { margin-right: 0; }
  .rp-ie-brand__badge, .rp-ie-brand__subtitle { display: none; }
  .rp-ie-brand__title { font-size: 14px; }
  .rp-ie-hide-sm { display: none !important; }
  .rp-ie-topbar__cluster + .rp-ie-topbar__cluster,
  .rp-ie-topbar__cluster + .rp-ie-iconbtn { padding-left: 0; border-left: 0; }
  .rp-ie-iconbtn { width: 44px; height: 44px; }
  .rp-ie-apply { height: 40px; padding: 0 14px; }
  .rp-ie-apply .rp-ie-icon { display: none; }

  .rp-ie-middle,
  .rp-ie-middle--no-props {
    display: flex;
    flex-direction: column;
  }
  .rp-ie-stage { order: 1; flex: 1 1 auto; padding: 12px; }
  .rp-ie-props {
    order: 2;
    flex: 0 0 auto;
    max-height: 40%;
    padding: 12px 16px;
    gap: 12px;
    border-right: 0;
    border-top: 1px solid var(--rp-ie-border);
  }
  .rp-ie-props__header { display: none; }
  .rp-ie-props__body { gap: 12px; }
  .rp-ie-rail {
    order: 3;
    flex: 0 0 auto;
    flex-direction: row;
    align-items: center;
    gap: 2px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
    border-right: 0;
    border-top: 1px solid var(--rp-ie-border);
    overflow-x: auto;
    overflow-y: hidden;
  }
  .rp-ie-rail--more-end { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent); }
  .rp-ie-rail--more-start { -webkit-mask-image: linear-gradient(to right, transparent, #000 40px); mask-image: linear-gradient(to right, transparent, #000 40px); }
  .rp-ie-rail--more-start.rp-ie-rail--more-end { -webkit-mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 40px), transparent); }
  .rp-ie-tile { width: 60px; min-height: 56px; }

  /* Compact, horizontally scrolling settings rows */
  .rp-ie-chips,
  .rp-ie-color-grid,
  .rp-ie-filter-grid {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 2px;
    scrollbar-width: none;
  }
  .rp-ie-chips::-webkit-scrollbar,
  .rp-ie-color-grid::-webkit-scrollbar,
  .rp-ie-filter-grid::-webkit-scrollbar { display: none; }
  .rp-ie-chip { flex: 0 0 auto; padding: 0 14px; }
  .rp-ie-swatch { flex: 0 0 36px; width: 36px; height: 36px; min-height: 0; }
  .rp-ie-filter-tile { flex: 0 0 88px; }
  .rp-ie-shape-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .rp-ie-shape-tile__label { display: none; }
  .rp-ie-shape-tile { min-height: 44px; }
  .rp-ie-props__label { margin-bottom: -4px; }
  .rp-ie-toast-root { left: 12px; right: 12px; bottom: 12px; }
}

@media (max-width: 359px) {
  .rp-ie-hide-xs { display: none !important; }
}

@media (max-width: 640px) {
  .rp-ie-modal { height: 100vh; height: 100dvh; max-width: none; border-radius: 0; }
  .rp-ie-modal-backdrop, .rp-editor-modal-backdrop { padding: 0; }
  .rp-ie-root { border-radius: 0; border: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rp-ie-root *, .rp-ie-root *::before, .rp-ie-root *::after {
    transition: none !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
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
