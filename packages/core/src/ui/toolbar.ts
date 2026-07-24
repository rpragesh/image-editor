/**
 * Shell UI — modern Figma+Linear-inspired layout that wraps the Fabric
 * canvas. Renders the top bar, left tool rail, right quick rail,
 * bottom quick-actions bar, and contextual properties panel.
 *
 * The class is still named `Toolbar` to keep back-compat with the
 * existing editor import — the exported callbacks contract is a
 * superset of the old one (all new fields are optional).
 */
import { ICONS } from './icons.js';
import { parseColor } from '../utils/defaults.js';
import type { LocalePack } from '../i18n/types.js';
import {
  EditorMode,
  RpEditorTheme,
  CropAspectRatio,
  ImageFilterPreset,
  ImageAdjustments,
} from '../types/index.js';

export interface ToolbarCallbacks {
  onModeChange: (mode: EditorMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onColorChange: (color: string) => void;
  onBrushWidthChange: (width: number) => void;
  onCropRatioChange: (ratio: number | null) => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onDeleteAnnotation?: () => void;

  /* Additive callbacks used by the new shell — all optional so
     external consumers instantiating Toolbar directly still work. */
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onFitZoom?: () => void;
  onZoomTo?: (level: number) => void;
  onOpacityChange?: (opacity: number) => void;
  onTextSize?: (size: number) => void;
  onEraserSize?: (size: number) => void;
  onFilterPreset?: (preset: ImageFilterPreset) => void;
  onAdjustChange?: <K extends keyof ImageAdjustments>(
    key: K,
    value: ImageAdjustments[K],
  ) => void;
  onResetEffects?: () => void;
  getImageEffects?: () => { preset: ImageFilterPreset; adjustments: ImageAdjustments };
  onApply?: () => void;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
}

/* ------------------------------------------------------------------ */

const GROUP_EXPANSION: Record<string, string[]> = {
  zoom: ['zoomIn', 'zoomOut'],
  transform: ['rotateLeft', 'rotateRight'],
  annotate: ['draw', 'text', 'callout', 'eraser'],
  shapes: [
    'shape-circle',
    'shape-ellipse',
    'shape-square',
    'shape-rectangle',
    'shape-arrow',
    'shape-polyline',
  ],
};

function expandDisabled(raw: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of raw) {
    const expanded = GROUP_EXPANSION[name];
    if (expanded) {
      expanded.forEach((n) => set.add(n));
      set.add(name);
    } else {
      set.add(name);
    }
  }
  return set;
}

/**
 * Escape a string for safe insertion into innerHTML. Used for
 * consumer-provided UI strings (empty-state text, filter labels, etc.)
 * to prevent HTML injection if the source is ever untrusted.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Descriptor for a left-rail tool tile. */
interface RailTool {
  id: string;
  icon: string;
  label: string;
  mode?: EditorMode;
  shortcut?: string;
  soon?: boolean;
}

const RAIL_TOOLS: RailTool[] = [
  { id: 'select', icon: 'select', label: 'Select', mode: 'move', shortcut: 'V' },
  { id: 'crop', icon: 'crop', label: 'Crop', mode: 'crop', shortcut: 'C' },
  { id: 'draw', icon: 'draw', label: 'Draw', mode: 'draw', shortcut: 'B' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', mode: 'eraser', shortcut: 'E' },
  { id: 'text', icon: 'text', label: 'Text', mode: 'text', shortcut: 'T' },
  { id: 'shapes', icon: 'shapes', label: 'Shapes', shortcut: 'S' },
  { id: 'callout', icon: 'callout', label: 'Callout', mode: 'callout' },
  { id: 'filters', icon: 'filters', label: 'Filters', mode: 'filters' },
  { id: 'adjust', icon: 'adjust', label: 'Adjust', mode: 'adjust' },
];

const SHAPES: Array<{
  id: string;
  icon: string;
  label: string;
  mode: EditorMode;
}> = [
  { id: 'shape-circle', icon: 'circle', label: 'Circle', mode: 'shape-circle' },
  { id: 'shape-ellipse', icon: 'ellipse', label: 'Ellipse', mode: 'shape-ellipse' },
  { id: 'shape-square', icon: 'square', label: 'Square', mode: 'shape-square' },
  {
    id: 'shape-rectangle',
    icon: 'rectangle',
    label: 'Rectangle',
    mode: 'shape-rectangle',
  },
  { id: 'shape-arrow', icon: 'arrow', label: 'Arrow', mode: 'shape-arrow' },
  {
    id: 'shape-polyline',
    icon: 'polyline',
    label: 'Line Path',
    mode: 'shape-polyline',
  },
];

const ZOOM_PRESETS: number[] = [0.25, 0.5, 0.75, 1, 1.5, 2];

/**
 * Canonical order + labels of the built-in filter presets. Consumers
 * can filter this list via `RpEditorConfig.filterPresets` and rename
 * tiles via `RpEditorConfig.filterPresetLabels`.
 */
const DEFAULT_FILTER_PRESETS: Array<{ id: ImageFilterPreset; label: string }> = [
  { id: 'none', label: 'Original' },
  { id: 'grayscale', label: 'B & W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'invert', label: 'Invert' },
];

/**
 * Additional options plumbed into the Toolbar beyond raw callbacks.
 * Kept as a single bag so future config knobs can be added without
 * churning the constructor signature.
 */
export interface ToolbarOptions {
  filterPresets?: ImageFilterPreset[];
  filterPresetLabels?: Partial<Record<ImageFilterPreset, string>>;
  /** Override the empty-state title (default `'Drop an image or click to upload'`). */
  emptyStateTitle?: string;
  /**
   * Override the empty-state subtitle (default `'Supported: PNG, JPEG, HEIC'`).
   * Pass `''` (empty string) to hide the subtitle row entirely.
   */
  emptyStateSubtitle?: string;
  /**
   * Optional bundled i18n pack. When supplied, every tool label,
   * shape name, panel heading, hint, and tooltip in the shell is
   * pulled from the pack instead of the hard-coded English text.
   * When omitted the toolbar behaves exactly as before (English).
   */
  labels?: LocalePack;
}

/* ------------------------------------------------------------------ */

export class Toolbar {
  private container: HTMLElement;
  private theme: RpEditorTheme;
  private colorPalette: string[];
  private cropRatios: CropAspectRatio[];
  private callbacks: ToolbarCallbacks;
  private disabledSet: Set<string>;
  private options: ToolbarOptions;

  private rootEl: HTMLElement | null = null;
  private stageSlotEl: HTMLElement | null = null;
  private propsPanelEl: HTMLElement | null = null;
  private bottomSliderEl: HTMLElement | null = null;
  private zoomLabelEl: HTMLElement | null = null;
  private zoomMenuEl: HTMLElement | null = null;
  private fullscreenBtnEl: HTMLButtonElement | null = null;
  private fullscreenChangeHandler: (() => void) | null = null;
  private toastRootEl: HTMLElement | null = null;
  private statusLiveEl: HTMLElement | null = null;

  private activeMode: EditorMode = 'move';
  private zoomLevel = 1;
  private canUndo = false;
  private canRedo = false;
  private recentColors: string[] = [];
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  /** Resolved i18n pack. `null` = fall back to the hard-coded English literals. */
  private labels: LocalePack | null = null;

  constructor(
    container: HTMLElement,
    theme: RpEditorTheme,
    colorPalette: string[],
    cropRatios: CropAspectRatio[],
    callbacks: ToolbarCallbacks,
    disabledFeatures: string[] = [],
    options: ToolbarOptions = {},
  ) {
    this.container = container;
    this.theme = theme;
    this.colorPalette = colorPalette;
    this.cropRatios = cropRatios;
    this.callbacks = callbacks;
    this.disabledSet = expandDisabled(disabledFeatures);
    this.options = options;
    this.labels = options.labels ?? null;
  }

  /* ================================================================ */
  /*  Public API                                                      */
  /* ================================================================ */

  render(): void {
    // Root shell
    const root = document.createElement('div');
    root.className = 'rp-ie-root';
    root.setAttribute('data-theme', this.theme.variant || 'dark');
    this.applyThemeVars(root);

    root.appendChild(this.buildTopBar());

    const middle = document.createElement('div');
    middle.className = 'rp-ie-middle';
    middle.appendChild(this.buildLeftRail());
    middle.appendChild(this.buildPropsPanel());
    middle.appendChild(this.buildStage());
    middle.appendChild(this.buildRightRail());
    root.appendChild(middle);

    root.appendChild(this.buildBottomBar());

    // Toast root (bottom-right)
    const toast = document.createElement('div');
    toast.className = 'rp-ie-toast-root';
    toast.setAttribute('aria-live', 'polite');
    root.appendChild(toast);
    this.toastRootEl = toast;

    // Off-screen aria-live for zoom / status announcements
    const status = document.createElement('div');
    status.className = 'rp-ie-sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.appendChild(status);
    this.statusLiveEl = status;

    this.container.appendChild(root);
    this.rootEl = root;

    this.updateActiveTool();
    this.updatePropsPanel();
    this.updateZoomLabel();
    this.updateHistoryButtons();
    // Initial zoom state — zoom-out is disabled at 1× baseline.
    this.setDisabledState('zoomOut', false);
    this.setDisabledState('zoomIn', true);

    // Outside-click for the zoom menu
    this.outsideClickHandler = (e: MouseEvent) => {
      if (
        this.zoomMenuEl &&
        this.zoomMenuEl.style.display !== 'none' &&
        !(e.target as Node)?.parentElement?.closest('.rp-ie-zoom-trigger') &&
        !this.zoomMenuEl.contains(e.target as Node)
      ) {
        this.zoomMenuEl.style.display = 'none';
      }
    };
    document.addEventListener('mousedown', this.outsideClickHandler, true);

    // Keep the fullscreen button icon/tooltip in sync with actual
    // document fullscreen state (covers Esc-to-exit and user-driven
    // toggles).
    if (this.fullscreenBtnEl) {
      this.fullscreenChangeHandler = () => this.refreshFullscreenButton();
      document.addEventListener(
        'fullscreenchange',
        this.fullscreenChangeHandler,
      );
      this.refreshFullscreenButton();
    }
  }

  /** Slot the canvas wrapper element into the shell stage. */
  attachCanvasWrapper(wrapper: HTMLElement): void {
    if (!this.stageSlotEl) return;
    // Remove empty state if present
    const empty = this.stageSlotEl.querySelector('.rp-ie-empty');
    if (empty) empty.remove();
    this.stageSlotEl.appendChild(wrapper);
  }

  updateZoomState(zoomLevel: number): void {
    this.zoomLevel = zoomLevel;
    this.updateZoomLabel();
    this.setDisabledState('zoomOut', zoomLevel > 1);
    this.setDisabledState('zoomIn', zoomLevel < 5);
  }

  updateHistoryState(canUndo: boolean, canRedo: boolean): void {
    this.canUndo = canUndo;
    this.canRedo = canRedo;
    this.updateHistoryButtons();
  }

  setActiveMode(mode: EditorMode): void {
    this.activeMode = mode;
    this.updateActiveTool();
    this.updatePropsPanel();
    this.updateBottomSlider();
  }

  showToast(message: string, kind: 'info' | 'error' = 'info'): void {
    if (!this.toastRootEl) return;
    const el = document.createElement('div');
    el.className = `rp-ie-toast rp-ie-toast--${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);

    const close = document.createElement('button');
    close.className = 'rp-ie-toast-close';
    close.innerHTML = ICONS.close;
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => el.remove());
    el.appendChild(close);

    this.toastRootEl.appendChild(el);
    window.setTimeout(() => el.remove(), 6000);
  }

  destroy(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }
    if (this.fullscreenChangeHandler) {
      document.removeEventListener(
        'fullscreenchange',
        this.fullscreenChangeHandler,
      );
      this.fullscreenChangeHandler = null;
    }
    this.rootEl?.remove();
    this.rootEl = null;
    this.stageSlotEl = null;
    this.propsPanelEl = null;
    this.bottomSliderEl = null;
    this.zoomLabelEl = null;
    this.zoomMenuEl = null;
    this.fullscreenBtnEl = null;
    this.toastRootEl = null;
    this.statusLiveEl = null;
  }

  /** Expose the stage slot so the editor can mount its canvas into it. */
  getStageSlot(): HTMLElement | null {
    return this.stageSlotEl;
  }

  /* ================================================================ */
  /*  Theme mapping                                                   */
  /* ================================================================ */

  private applyThemeVars(root: HTMLElement): void {
    const t = this.theme;
    // Accent: prefer new token → toolbarActiveBackground → deprecated toolbarActiveIconColor
    const accent =
      t.accent || t.toolbarActiveBackground || t.toolbarActiveIconColor || '#083a81';
    const accentContrast = t.accentContrast || t.toolbarActiveTextColor || '#FFFFFF';
    const surface0 = t.surface0 || t.editorBackground || '#0B0D12';
    const surface1 = t.surface1 || t.toolbarBackground || '#12151C';
    const surface2 = t.surface2 || '#181C25';
    const border = t.borderColor || 'rgba(255,255,255,0.06)';
    const text = t.textPrimary || t.toolbarIconColor || t.headerTextColor || '#ECEEF3';
    const textMuted = t.textMuted || '#8A93A6';
    const radius = t.buttonBorderRadius || '10px';
    const modalRadius = t.modalBorderRadius || '16px';

    const cta = t.applyButtonBackground || accent;
    const ctaText = t.applyButtonTextColor || accentContrast;

    root.style.setProperty('--rp-ie-surface-0', surface0);
    root.style.setProperty('--rp-ie-surface-1', surface1);
    root.style.setProperty('--rp-ie-surface-2', surface2);
    root.style.setProperty('--rp-ie-border', border);
    root.style.setProperty('--rp-ie-text', text);
    root.style.setProperty('--rp-ie-text-muted', textMuted);
    root.style.setProperty('--rp-ie-accent', accent);
    root.style.setProperty('--rp-ie-accent-contrast', accentContrast);
    root.style.setProperty('--rp-ie-cta', cta);
    root.style.setProperty('--rp-ie-cta-text', ctaText);
    root.style.setProperty('--rp-ie-radius', radius);
    root.style.setProperty('--rp-ie-radius-lg', modalRadius);

    // Optional brand badge / logo sizing. When left unset the CSS
    // defaults (40px badge, 22/24px logo) remain in force.
    if (typeof t.headerBadgeSize === 'number' && t.headerBadgeSize > 0) {
      root.style.setProperty(
        '--rp-ie-brand-badge-size',
        `${t.headerBadgeSize}px`,
      );
    }
    if (typeof t.headerLogoSize === 'number' && t.headerLogoSize > 0) {
      root.style.setProperty(
        '--rp-ie-brand-logo-size',
        `${t.headerLogoSize}px`,
      );
    }

    // Publish the accent as an RGB triplet so downstream CSS rules
    // (tinted "active" backgrounds, brand badge gradient, focus rings)
    // can synthesize semi-transparent variants that stay in-sync with
    // the themed accent instead of leaking the default purple.
    const accentRgb = parseColor(accent) || parseColor(cta);
    if (accentRgb) {
      root.style.setProperty(
        '--rp-ie-accent-rgb',
        `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`
      );
    }
  }

  /* ================================================================ */
  /*  Top bar                                                         */
  /* ================================================================ */

  private buildTopBar(): HTMLElement {
    const bar = document.createElement('header');
    bar.className = 'rp-ie-topbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Editor top bar');

    // Left: brand + title
    const brand = document.createElement('div');
    brand.className = 'rp-ie-brand';

    // Badge is optional — omit entirely when `showHeaderBadge === false`.
    const showBadge = this.theme.showHeaderBadge !== false;
    if (showBadge) {
      const badge = document.createElement('div');
      badge.className = 'rp-ie-brand__badge';
      if (this.theme.headerLogo) {
        const logoImg = document.createElement('img');
        logoImg.className = 'rp-ie-brand__logo';
        logoImg.src = this.theme.headerLogo;
        logoImg.alt = '';
        logoImg.decoding = 'async';
        logoImg.loading = 'lazy';
        badge.appendChild(logoImg);
      } else {
        badge.innerHTML = ICONS.logo;
      }
      brand.appendChild(badge);
    }

    const titles = document.createElement('div');
    titles.className = 'rp-ie-brand__titles';
    const title = document.createElement('div');
    title.className = 'rp-ie-brand__title';
    title.textContent =
      this.theme.headerTitle || this.labels?.headerTitle || 'Photo Editor';
    titles.appendChild(title);

    // Subtitle: default text is kept for back-compat. Passing an empty
    // string via `theme.headerSubtitle` opts out of the subtitle row.
    const subtitleText =
      this.theme.headerSubtitle !== undefined
        ? this.theme.headerSubtitle
        : this.labels?.headerSubtitle ?? 'Edit your image with ease';
    if (subtitleText) {
      const subtitle = document.createElement('div');
      subtitle.className = 'rp-ie-brand__subtitle';
      subtitle.textContent = subtitleText;
      titles.appendChild(subtitle);
    }
    brand.appendChild(titles);

    bar.appendChild(brand);

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'rp-ie-topbar__spacer';
    bar.appendChild(spacer);

    // Right: actions
    const actions = document.createElement('div');
    actions.className = 'rp-ie-topbar__actions';

    const undoBtn = this.makeIconButton({
      icon: 'undo',
      label: this.labels?.undo ?? 'Undo',
      shortcut: '⌘Z',
      onClick: () => this.callbacks.onUndo(),
      dataAttr: { historyRole: 'undo' },
    });
    actions.appendChild(undoBtn);

    const redoBtn = this.makeIconButton({
      icon: 'redo',
      label: this.labels?.redo ?? 'Redo',
      shortcut: '⌘⇧Z',
      onClick: () => this.callbacks.onRedo(),
      dataAttr: { historyRole: 'redo' },
    });
    actions.appendChild(redoBtn);

    // Zoom trigger + menu
    actions.appendChild(this.buildZoomMenu());

    // Fullscreen toggle (optional — hidden when the host disables it
    // or omits the callback). Fit-to-screen is still available from
    // the Zoom dropdown.
    if (
      this.callbacks.onToggleFullscreen &&
      !this.disabledSet.has('fullscreen')
    ) {
      const fsBtn = this.makeIconButton({
        icon: 'fullscreen',
        label: this.labels?.fullscreen ?? 'Fullscreen',
        onClick: () => this.callbacks.onToggleFullscreen?.(),
      });
      this.fullscreenBtnEl = fsBtn as HTMLButtonElement;
      actions.appendChild(fsBtn);
    }

    if (this.callbacks.onApply) {
      const applyBtn = document.createElement('button');
      applyBtn.className = 'rp-ie-btn rp-ie-btn--primary';
      applyBtn.type = 'button';
      applyBtn.setAttribute('data-role', 'apply');
      const applyLabel =
        this.theme.applyButtonText || this.labels?.applyButton || 'Apply';
      applyBtn.innerHTML = `<span class="rp-ie-icon">${ICONS.apply}</span><span>${applyLabel}</span>`;
      this.attachTooltip(applyBtn, `${applyLabel} · ⌘⏎`);
      applyBtn.addEventListener('click', () => this.callbacks.onApply?.());
      actions.appendChild(applyBtn);
    }

    if (this.callbacks.onClose) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'rp-ie-btn rp-ie-btn--ghost';
      closeBtn.type = 'button';
      const closeLabel =
        this.theme.cancelButtonText || this.labels?.cancelButton || 'Close';
      closeBtn.innerHTML = `<span class="rp-ie-icon">${ICONS.close}</span><span>${closeLabel}</span>`;
      this.attachTooltip(closeBtn, `${closeLabel} · Esc`);
      closeBtn.addEventListener('click', () => this.callbacks.onClose?.());
      actions.appendChild(closeBtn);
    }

    bar.appendChild(actions);
    return bar;
  }

  private buildZoomMenu(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-zoom-trigger';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'rp-ie-btn rp-ie-btn--ghost rp-ie-zoom-btn';

    const label = document.createElement('span');
    label.className = 'rp-ie-zoom-label';
    label.textContent = '100%';
    trigger.appendChild(label);

    const chev = document.createElement('span');
    chev.className = 'rp-ie-icon rp-ie-icon--sm';
    chev.innerHTML = ICONS.chevronDown;
    trigger.appendChild(chev);

    this.attachTooltip(trigger, this.labels?.zoomTooltip ?? 'Zoom · +/− · 0 fit · 1 100%');
    this.zoomLabelEl = label;

    const menu = document.createElement('div');
    menu.className = 'rp-ie-menu';
    menu.style.display = 'none';

    ZOOM_PRESETS.forEach((p) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'rp-ie-menu__item';
      item.textContent = `${Math.round(p * 100)}%`;
      item.addEventListener('click', () => {
        menu.style.display = 'none';
        this.callbacks.onZoomTo?.(p);
      });
      menu.appendChild(item);
    });
    const fitItem = document.createElement('button');
    fitItem.type = 'button';
    fitItem.className = 'rp-ie-menu__item';
    fitItem.textContent = this.labels?.fit ?? 'Fit';
    fitItem.addEventListener('click', () => {
      menu.style.display = 'none';
      this.handleFit();
    });
    menu.appendChild(fitItem);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    this.zoomMenuEl = menu;
    return wrap;
  }

  /* ================================================================ */
  /*  Left rail                                                       */
  /* ================================================================ */

  private buildLeftRail(): HTMLElement {
    const rail = document.createElement('aside');
    rail.className = 'rp-ie-rail rp-ie-rail--left';
    rail.setAttribute('role', 'toolbar');
    rail.setAttribute('aria-label', 'Tools');

    RAIL_TOOLS.forEach((toolDef) => {
      // Translate the label from the resolved locale pack. When no
      // pack is supplied (external Toolbar consumers), fall back to
      // the English literal baked into the RAIL_TOOLS constant.
      const tool: RailTool = {
        ...toolDef,
        label:
          this.labels?.tool[toolDef.id as keyof LocalePack['tool']] ??
          toolDef.label,
      };
      // Skip "coming soon" placeholders — they only clutter the rail
      // and can't be activated. Reintroduce when the feature ships.
      if (tool.soon) return;
      // Hide if disabled via disabledFeatures
      if (tool.mode && this.disabledSet.has(tool.id)) return;
      if (tool.id === 'shapes' && SHAPES.every((s) => this.disabledSet.has(s.id))) return;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'rp-ie-tile';
      tile.dataset.railId = tool.id;
      if (tool.mode) tile.dataset.mode = tool.mode;
      if (tool.soon) tile.classList.add('rp-ie-tile--soon');
      tile.setAttribute('aria-label', tool.label);
      tile.setAttribute('aria-pressed', 'false');

      const icon = document.createElement('span');
      icon.className = 'rp-ie-icon';
      icon.innerHTML = ICONS[tool.icon] || '';
      tile.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'rp-ie-tile__label';
      label.textContent = tool.label;
      tile.appendChild(label);

      if (tool.soon) {
        const pill = document.createElement('span');
        pill.className = 'rp-ie-pill';
        pill.textContent = 'Soon';
        tile.appendChild(pill);
        tile.disabled = true;
      }

      const tipParts = [tool.label];
      if (tool.shortcut) tipParts.push(tool.shortcut);
      this.attachTooltip(tile, tipParts.join(' · '), 'right');

      tile.addEventListener('click', () => {
        if (tool.soon) return;
        if (tool.id === 'shapes') {
          // Default shapes to the first non-disabled shape
          const first = SHAPES.find((s) => !this.disabledSet.has(s.id));
          if (first) this.callbacks.onModeChange(first.mode);
          return;
        }
        if (tool.mode) this.callbacks.onModeChange(tool.mode);
      });

      rail.appendChild(tile);
    });

    return rail;
  }

  /* ================================================================ */
  /*  Right rail (contextual)                                         */
  /* ================================================================ */

  private buildRightRail(): HTMLElement {
    const rail = document.createElement('aside');
    rail.className = 'rp-ie-rail rp-ie-rail--right';
    rail.setAttribute('role', 'toolbar');
    rail.setAttribute('aria-label', 'Quick actions');

    const L = this.labels;
    const items: Array<{
      id: string;
      icon: string;
      label: string;
      shortcut?: string;
      onClick: () => void;
      mode?: EditorMode;
    }> = [
      {
        id: 'pen',
        icon: 'pen',
        label: L?.tool.pen ?? 'Pen',
        shortcut: 'B',
        mode: 'draw',
        onClick: () => this.callbacks.onModeChange('draw'),
      },
      {
        id: 'eraser',
        icon: 'eraser',
        label: L?.tool.eraser ?? 'Eraser',
        shortcut: 'E',
        mode: 'eraser',
        onClick: () => this.callbacks.onModeChange('eraser'),
      },
      {
        id: 'move',
        icon: 'move',
        label: L?.tool.move ?? 'Move',
        shortcut: 'V',
        mode: 'move',
        onClick: () => this.callbacks.onModeChange('move'),
      },
      {
        id: 'zoomIn',
        icon: 'zoomIn',
        label: L?.tool.zoomIn ?? 'Zoom In',
        shortcut: '+',
        onClick: () => this.callbacks.onZoomIn(),
      },
      {
        id: 'undo',
        icon: 'undo',
        label: L?.undo ?? 'Undo',
        shortcut: '⌘Z',
        onClick: () => this.callbacks.onUndo(),
      },
      {
        id: 'redo',
        icon: 'redo',
        label: L?.redo ?? 'Redo',
        shortcut: '⌘⇧Z',
        onClick: () => this.callbacks.onRedo(),
      },
    ];

    items.forEach((item) => {
      if (this.disabledSet.has(item.id)) return;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'rp-ie-tile rp-ie-tile--compact';
      tile.dataset.quickId = item.id;
      if (item.mode) tile.dataset.mode = item.mode;
      if (item.id === 'undo') tile.dataset.historyRole = 'undo';
      if (item.id === 'redo') tile.dataset.historyRole = 'redo';

      const icon = document.createElement('span');
      icon.className = 'rp-ie-icon';
      icon.innerHTML = ICONS[item.icon] || '';
      tile.appendChild(icon);

      const lbl = document.createElement('span');
      lbl.className = 'rp-ie-tile__label';
      lbl.textContent = item.label;
      tile.appendChild(lbl);

      const tipParts = [item.label];
      if (item.shortcut) tipParts.push(item.shortcut);
      this.attachTooltip(tile, tipParts.join(' · '), 'left');
      tile.addEventListener('click', item.onClick);

      rail.appendChild(tile);
    });

    return rail;
  }

  /* ================================================================ */
  /*  Stage + empty state                                             */
  /* ================================================================ */

  private buildStage(): HTMLElement {
    const stage = document.createElement('section');
    stage.className = 'rp-ie-stage';

    const slot = document.createElement('div');
    slot.className = 'rp-ie-stage__slot';

    // Empty state overlay — removed once canvas wrapper is attached
    const emptyTitle =
      this.options.emptyStateTitle ??
      this.labels?.emptyStateTitle ??
      'Drop an image or click to upload';
    const emptySubtitle =
      this.options.emptyStateSubtitle !== undefined
        ? this.options.emptyStateSubtitle
        : this.labels?.emptyStateSubtitle ?? 'Supported: PNG, JPEG, HEIC';
    const empty = document.createElement('div');
    empty.className = 'rp-ie-empty';
    const subtitleMarkup = emptySubtitle
      ? `<div class="rp-ie-empty__subtitle">${escapeHtml(emptySubtitle)}</div>`
      : '';
    empty.innerHTML = `
      <div class="rp-ie-empty__illustration"><span class="rp-ie-icon rp-ie-icon--xl">${ICONS.imagePlaceholder}</span></div>
      <div class="rp-ie-empty__title">${escapeHtml(emptyTitle)}</div>
      ${subtitleMarkup}
    `;
    slot.appendChild(empty);

    stage.appendChild(slot);
    this.stageSlotEl = slot;
    return stage;
  }

  /* ================================================================ */
  /*  Properties panel                                                */
  /* ================================================================ */

  private buildPropsPanel(): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'rp-ie-props';
    panel.setAttribute('aria-label', 'Tool properties');
    this.propsPanelEl = panel;
    return panel;
  }

  private updatePropsPanel(): void {
    if (!this.propsPanelEl) return;
    const panel = this.propsPanelEl;
    panel.innerHTML = '';

    const mode = this.activeMode;
    const isShape = mode.startsWith('shape-');
    const T = this.labels?.props.title;
    let title = T?.draw ?? 'Draw';
    let body: HTMLElement;

    if (mode === 'draw') {
      title = T?.draw ?? 'Draw';
      body = this.renderDrawProps();
    } else if (mode === 'eraser') {
      title = T?.eraser ?? 'Eraser';
      body = this.renderEraserProps();
    } else if (mode === 'text') {
      title = T?.text ?? 'Text';
      body = this.renderTextProps();
    } else if (mode === 'crop') {
      title = T?.crop ?? 'Crop';
      body = this.renderCropProps();
    } else if (isShape) {
      title = T?.shapes ?? 'Shapes';
      body = this.renderShapeProps();
    } else if (mode === 'callout') {
      title = T?.callout ?? 'Callout';
      body = this.renderCalloutProps();
    } else if (mode === 'filters') {
      title = T?.filters ?? 'Filters';
      body = this.renderFilterProps();
    } else if (mode === 'adjust') {
      title = T?.adjust ?? 'Adjust';
      body = this.renderAdjustProps();
    } else {
      title = T?.move ?? 'Move';
      body = this.renderMoveProps();
    }

    // Header with collapse chevron
    const header = document.createElement('header');
    header.className = 'rp-ie-props__header';
    header.innerHTML = `<span>${title}</span><span class="rp-ie-icon rp-ie-icon--sm">${ICONS.chevronUp}</span>`;
    panel.appendChild(header);

    panel.appendChild(body);
  }

  private renderDrawProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;

    wrap.appendChild(
      this.buildSlider(P?.brushSize ?? 'Brush Size', 1, 40, 10, 'px', (val) =>
        this.callbacks.onBrushWidthChange(val),
      ),
    );
    wrap.appendChild(
      this.buildSlider(P?.opacity ?? 'Opacity', 10, 100, 100, '%', (val) =>
        this.callbacks.onOpacityChange?.(val / 100),
      ),
    );
    wrap.appendChild(this.buildColorSection());
    return wrap;
  }

  private renderEraserProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;
    wrap.appendChild(
      this.buildSlider(P?.eraserSize ?? 'Eraser Size', 5, 60, 20, 'px', (val) =>
        this.callbacks.onEraserSize?.(val),
      ),
    );
    const hint = document.createElement('p');
    hint.className = 'rp-ie-hint';
    hint.textContent =
      P?.hintEraser ?? 'Tap or drag on an annotation to remove it.';
    wrap.appendChild(hint);
    return wrap;
  }

  private renderTextProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;
    wrap.appendChild(
      this.buildSlider(P?.fontSize ?? 'Font Size', 8, 96, 24, 'px', (val) =>
        this.callbacks.onTextSize?.(val),
      ),
    );
    wrap.appendChild(this.buildColorSection());
    return wrap;
  }

  private renderCropProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;

    const label = document.createElement('div');
    label.className = 'rp-ie-props__label';
    label.textContent = P?.aspectRatio ?? 'Aspect Ratio';
    wrap.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'rp-ie-chips';
    this.cropRatios.forEach((r, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rp-ie-chip';
      chip.textContent = r.label;
      if (idx === 0) chip.classList.add('rp-ie-chip--active');
      chip.addEventListener('click', () => {
        chips
          .querySelectorAll('.rp-ie-chip')
          .forEach((c) => c.classList.remove('rp-ie-chip--active'));
        chip.classList.add('rp-ie-chip--active');
        this.callbacks.onCropRatioChange(r.value);
      });
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);

    const actions = document.createElement('div');
    actions.className = 'rp-ie-props__actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'rp-ie-btn rp-ie-btn--primary rp-ie-btn--sm';
    apply.innerHTML = `<span class="rp-ie-icon">${ICONS.apply}</span><span>${P?.applyCrop ?? 'Apply Crop'}</span>`;
    apply.addEventListener('click', () => this.callbacks.onApplyCrop());
    actions.appendChild(apply);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'rp-ie-btn rp-ie-btn--ghost rp-ie-btn--sm';
    cancel.innerHTML = `<span class="rp-ie-icon">${ICONS.close}</span><span>${P?.cancel ?? 'Cancel'}</span>`;
    cancel.addEventListener('click', () => this.callbacks.onCancelCrop());
    actions.appendChild(cancel);
    wrap.appendChild(actions);

    return wrap;
  }

  private renderShapeProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;

    const label = document.createElement('div');
    label.className = 'rp-ie-props__label';
    label.textContent = P?.shape ?? 'Shape';
    wrap.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'rp-ie-shape-grid';
    SHAPES.forEach((sDef) => {
      if (this.disabledSet.has(sDef.id)) return;
      // Map shape id ("shape-rectangle") to LocalePack key ("rectangle")
      const key = sDef.id.replace(/^shape-/, '') as keyof LocalePack['shape'];
      const s = { ...sDef, label: this.labels?.shape[key] ?? sDef.label };
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rp-ie-shape-tile';
      btn.dataset.mode = s.mode;
      btn.innerHTML = `<span class="rp-ie-icon">${ICONS[s.icon]}</span><span class="rp-ie-shape-tile__label">${s.label}</span>`;
      if (s.mode === this.activeMode) btn.classList.add('rp-ie-shape-tile--active');
      btn.addEventListener('click', () => this.callbacks.onModeChange(s.mode));
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);

    wrap.appendChild(
      this.buildSlider(P?.strokeWidth ?? 'Stroke Width', 1, 40, 10, 'px', (val) =>
        this.callbacks.onBrushWidthChange(val),
      ),
    );
    wrap.appendChild(this.buildColorSection());

    if (this.callbacks.onDeleteAnnotation) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'rp-ie-btn rp-ie-btn--danger rp-ie-btn--sm';
      del.innerHTML = `<span class="rp-ie-icon">${ICONS.delete}</span><span>${P?.deleteSelected ?? 'Delete selected'}</span>`;
      del.addEventListener('click', () => this.callbacks.onDeleteAnnotation?.());
      wrap.appendChild(del);
    }
    return wrap;
  }

  private renderCalloutProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;
    wrap.appendChild(this.buildColorSection());
    if (this.callbacks.onDeleteAnnotation) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'rp-ie-btn rp-ie-btn--danger rp-ie-btn--sm';
      del.innerHTML = `<span class="rp-ie-icon">${ICONS.delete}</span><span>${P?.deleteSelected ?? 'Delete selected'}</span>`;
      del.addEventListener('click', () => this.callbacks.onDeleteAnnotation?.());
      wrap.appendChild(del);
    }
    return wrap;
  }

  private renderMoveProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const p = document.createElement('p');
    p.className = 'rp-ie-hint';
    p.textContent =
      this.labels?.props.hintMove ??
      'Drag to pan · pinch or scroll to zoom · pick a tool to start editing.';
    wrap.appendChild(p);
    return wrap;
  }

  private renderFilterProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;

    const label = document.createElement('div');
    label.className = 'rp-ie-props__label';
    label.textContent = P?.preset ?? 'Preset';
    wrap.appendChild(label);

    // Resolve the effective preset list. When the consumer passes a
    // whitelist we honor its order and drop unknown ids silently. When
    // unset, we fall back to the canonical built-in list.
    const whitelist = this.options.filterPresets;
    const labelOverrides = this.options.filterPresetLabels || {};
    const defaultsById = new Map(
      DEFAULT_FILTER_PRESETS.map((p) => [p.id, p.label] as const),
    );
    let presets: Array<{ id: ImageFilterPreset; label: string }>;
    if (Array.isArray(whitelist) && whitelist.length > 0) {
      presets = whitelist
        .filter((id) => defaultsById.has(id))
        .map((id) => ({
          id,
          label: labelOverrides[id] ?? (defaultsById.get(id) as string),
        }));
      // Empty after filtering — keep the panel usable by falling back.
      if (presets.length === 0) {
        presets = DEFAULT_FILTER_PRESETS.map((p) => ({
          id: p.id,
          label: labelOverrides[p.id] ?? p.label,
        }));
      }
    } else {
      presets = DEFAULT_FILTER_PRESETS.map((p) => ({
        id: p.id,
        label: labelOverrides[p.id] ?? p.label,
      }));
    }

    const current = this.callbacks.getImageEffects?.().preset || 'none';

    const grid = document.createElement('div');
    grid.className = 'rp-ie-filter-grid';
    presets.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rp-ie-filter-tile';
      btn.dataset.preset = p.id;
      if (p.id === current) btn.classList.add('rp-ie-filter-tile--active');

      const swatch = document.createElement('span');
      swatch.className = `rp-ie-filter-swatch rp-ie-filter-swatch--${p.id}`;
      btn.appendChild(swatch);

      const name = document.createElement('span');
      name.className = 'rp-ie-filter-tile__label';
      name.textContent = p.label;
      btn.appendChild(name);

      btn.addEventListener('click', () => {
        grid
          .querySelectorAll('.rp-ie-filter-tile')
          .forEach((el) => el.classList.remove('rp-ie-filter-tile--active'));
        btn.classList.add('rp-ie-filter-tile--active');
        this.callbacks.onFilterPreset?.(p.id);
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'rp-ie-props__actions';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'rp-ie-btn rp-ie-btn--ghost rp-ie-btn--sm';
    resetBtn.innerHTML = `<span class="rp-ie-icon">${ICONS.reset || ICONS.close}</span><span>${P?.resetEffects ?? 'Reset effects'}</span>`;
    resetBtn.addEventListener('click', () => {
      this.callbacks.onResetEffects?.();
      this.updatePropsPanel();
    });
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  private renderAdjustProps(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-props__body';
    const P = this.labels?.props;

    const current =
      this.callbacks.getImageEffects?.().adjustments ||
      { brightness: 0, contrast: 0, saturation: 0, blur: 0 };

    const makeSigned = (
      label: string,
      key: keyof ImageAdjustments,
      initial: number,
    ) =>
      this.buildBipolarSlider(label, -100, 100, Math.round(initial * 100), (v) => {
        this.callbacks.onAdjustChange?.(key, (v / 100) as any);
      });

    wrap.appendChild(makeSigned(P?.brightness ?? 'Brightness', 'brightness', current.brightness));
    wrap.appendChild(makeSigned(P?.contrast ?? 'Contrast', 'contrast', current.contrast));
    wrap.appendChild(makeSigned(P?.saturation ?? 'Saturation', 'saturation', current.saturation));
    wrap.appendChild(
      this.buildSlider(P?.blur ?? 'Blur', 0, 100, Math.round(current.blur * 100), '%', (v) => {
        this.callbacks.onAdjustChange?.('blur', (v / 100) as any);
      }),
    );

    const actions = document.createElement('div');
    actions.className = 'rp-ie-props__actions';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'rp-ie-btn rp-ie-btn--ghost rp-ie-btn--sm';
    resetBtn.innerHTML = `<span class="rp-ie-icon">${ICONS.reset || ICONS.close}</span><span>${P?.resetAdjustments ?? 'Reset adjustments'}</span>`;
    resetBtn.addEventListener('click', () => {
      this.callbacks.onResetEffects?.();
      this.updatePropsPanel();
    });
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  private buildBipolarSlider(
    label: string,
    min: number,
    max: number,
    initial: number,
    onChange: (val: number) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-slider';

    const row = document.createElement('div');
    row.className = 'rp-ie-slider__row';
    const l = document.createElement('span');
    l.className = 'rp-ie-slider__label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'rp-ie-slider__value';
    v.textContent = `${initial > 0 ? '+' : ''}${initial}`;
    row.appendChild(l);
    row.appendChild(v);
    wrap.appendChild(row);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(initial);
    input.step = '1';
    input.className = 'rp-ie-range rp-ie-range--bipolar';
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10);
      v.textContent = `${n > 0 ? '+' : ''}${n}`;
      onChange(n);
    });
    wrap.appendChild(input);
    return wrap;
  }

  private buildColorSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-color-section';
    const P = this.labels?.props;

    const label = document.createElement('div');
    label.className = 'rp-ie-props__label';
    label.textContent = P?.colors ?? 'Colors';
    wrap.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'rp-ie-color-grid';
    this.colorPalette.forEach((color, idx) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'rp-ie-swatch';
      sw.style.setProperty('--swatch-color', color);
      sw.setAttribute('aria-label', `Color ${color}`);
      if (idx === 0) sw.classList.add('rp-ie-swatch--active');
      sw.addEventListener('click', () => {
        grid
          .querySelectorAll('.rp-ie-swatch')
          .forEach((s) => s.classList.remove('rp-ie-swatch--active'));
        sw.classList.add('rp-ie-swatch--active');
        this.pushRecentColor(color);
        this.callbacks.onColorChange(color);
      });
      grid.appendChild(sw);
    });
    wrap.appendChild(grid);

    if (this.recentColors.length > 0) {
      const recentLabel = document.createElement('div');
      recentLabel.className = 'rp-ie-props__label rp-ie-props__label--sub';
      recentLabel.textContent = P?.recent ?? 'Recent';
      wrap.appendChild(recentLabel);

      const recentGrid = document.createElement('div');
      recentGrid.className = 'rp-ie-color-grid';
      this.recentColors.forEach((color) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'rp-ie-swatch';
        sw.style.setProperty('--swatch-color', color);
        sw.setAttribute('aria-label', `Recent ${color}`);
        sw.addEventListener('click', () => this.callbacks.onColorChange(color));
        recentGrid.appendChild(sw);
      });
      wrap.appendChild(recentGrid);
    }

    const morePicker = document.createElement('label');
    morePicker.className = 'rp-ie-custom-color';
    morePicker.innerHTML = `<span class="rp-ie-icon">${ICONS.colors}</span><span>${P?.customColor ?? 'Custom Color'}</span>`;
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'rp-ie-custom-color__input';
    input.addEventListener('input', () => {
      this.pushRecentColor(input.value);
      this.callbacks.onColorChange(input.value);
    });
    morePicker.appendChild(input);
    wrap.appendChild(morePicker);

    return wrap;
  }

  private pushRecentColor(color: string): void {
    const c = color.toLowerCase();
    this.recentColors = [c, ...this.recentColors.filter((x) => x !== c)].slice(0, 8);
  }

  private buildSlider(
    label: string,
    min: number,
    max: number,
    initial: number,
    unit: string,
    onChange: (val: number) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'rp-ie-slider';

    const row = document.createElement('div');
    row.className = 'rp-ie-slider__row';
    const l = document.createElement('span');
    l.className = 'rp-ie-slider__label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'rp-ie-slider__value';
    v.textContent = `${initial}${unit}`;
    row.appendChild(l);
    row.appendChild(v);
    wrap.appendChild(row);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(initial);
    input.className = 'rp-ie-range';
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10);
      v.textContent = `${n}${unit}`;
      onChange(n);
    });
    wrap.appendChild(input);
    return wrap;
  }

  /* ================================================================ */
  /*  Bottom bar                                                      */
  /* ================================================================ */

  private buildBottomBar(): HTMLElement {
    const bar = document.createElement('footer');
    bar.className = 'rp-ie-bottombar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Quick actions');

    const section = document.createElement('div');
    section.className = 'rp-ie-bottombar__section';

    const label = document.createElement('div');
    label.className = 'rp-ie-bottombar__label';
    label.textContent = this.labels?.props.quickActions ?? 'Quick Actions';
    section.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'rp-ie-quickactions';

    const L = this.labels;
    const items: Array<{
      id: string;
      icon: string;
      label: string;
      shortcut?: string;
      mode?: EditorMode;
      onClick: () => void;
    }> = [
      {
        id: 'select',
        icon: 'select',
        label: L?.tool.select ?? 'Select',
        shortcut: 'V',
        mode: 'move',
        onClick: () => this.callbacks.onModeChange('move'),
      },
      {
        id: 'crop',
        icon: 'crop',
        label: L?.tool.crop ?? 'Crop',
        shortcut: 'C',
        mode: 'crop',
        onClick: () => this.callbacks.onModeChange('crop'),
      },
      {
        id: 'zoomIn',
        icon: 'zoom',
        label: L?.tool.zoom ?? 'Zoom',
        shortcut: '+',
        onClick: () => this.callbacks.onZoomIn(),
      },
      {
        id: 'rotateLeft',
        icon: 'rotateLeft',
        label: L?.tool.rotateLeft ?? 'Rotate Left',
        shortcut: '⇧R',
        onClick: () => this.callbacks.onRotateLeft(),
      },
      {
        id: 'rotateRight',
        icon: 'rotateRight',
        label: L?.tool.rotateRight ?? 'Rotate Right',
        shortcut: 'R',
        onClick: () => this.callbacks.onRotateRight(),
      },
      {
        id: 'flipH',
        icon: 'flipH',
        label: L?.tool.flipH ?? 'Flip H',
        shortcut: 'H',
        onClick: () => this.callbacks.onFlipHorizontal?.(),
      },
      {
        id: 'flipV',
        icon: 'flipV',
        label: L?.tool.flipV ?? 'Flip V',
        shortcut: '⇧H',
        onClick: () => this.callbacks.onFlipVertical?.(),
      },
      {
        id: 'reset',
        icon: 'reset',
        label: L?.tool.reset ?? 'Reset',
        onClick: () => this.callbacks.onReset(),
      },
    ];

    items.forEach((item) => {
      if (this.disabledSet.has(item.id)) return;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'rp-ie-quickaction';
      tile.dataset.quickId = item.id;
      if (item.mode) tile.dataset.mode = item.mode;

      const icon = document.createElement('span');
      icon.className = 'rp-ie-icon';
      icon.innerHTML = ICONS[item.icon] || '';
      tile.appendChild(icon);
      const lbl = document.createElement('span');
      lbl.className = 'rp-ie-quickaction__label';
      lbl.textContent = item.label;
      tile.appendChild(lbl);

      const tip = item.shortcut ? `${item.label} · ${item.shortcut}` : item.label;
      this.attachTooltip(tile, tip);
      tile.addEventListener('click', item.onClick);
      actions.appendChild(tile);
    });

    section.appendChild(actions);
    bar.appendChild(section);

    // Contextual slider (right side)
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'rp-ie-bottombar__slider';
    sliderWrap.style.display = 'none';
    this.bottomSliderEl = sliderWrap;
    bar.appendChild(sliderWrap);

    return bar;
  }

  private updateBottomSlider(): void {
    if (!this.bottomSliderEl) return;
    this.bottomSliderEl.innerHTML = '';
    const mode = this.activeMode;
    const P = this.labels?.props;
    let label = '';
    let onChange: ((n: number) => void) | null = null;
    let initial = 10;
    let min = 1;
    let max = 40;

    if (mode === 'draw' || mode.startsWith('shape-')) {
      label = P?.brushSize ?? 'Brush Size';
      onChange = (n) => this.callbacks.onBrushWidthChange(n);
    } else if (mode === 'eraser') {
      label = P?.eraserSize ?? 'Eraser Size';
      onChange = (n) => this.callbacks.onEraserSize?.(n);
      initial = 20;
      max = 60;
    } else if (mode === 'text') {
      label = P?.fontSize ?? 'Font Size';
      onChange = (n) => this.callbacks.onTextSize?.(n);
      initial = 24;
      min = 8;
      max = 96;
    }

    if (!onChange) {
      this.bottomSliderEl.style.display = 'none';
      return;
    }

    this.bottomSliderEl.style.display = 'flex';
    const l = document.createElement('span');
    l.className = 'rp-ie-slider__label';
    l.textContent = label;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.value = String(initial);
    range.className = 'rp-ie-range';
    const v = document.createElement('span');
    v.className = 'rp-ie-slider__value';
    v.textContent = `${initial}px`;
    range.addEventListener('input', () => {
      const n = parseInt(range.value, 10);
      v.textContent = `${n}px`;
      onChange!(n);
    });
    this.bottomSliderEl.appendChild(l);
    this.bottomSliderEl.appendChild(range);
    this.bottomSliderEl.appendChild(v);
  }

  /* ================================================================ */
  /*  Helpers                                                         */
  /* ================================================================ */

  private updateActiveTool(): void {
    if (!this.rootEl) return;
    const activeMode = this.activeMode;
    const isShape = activeMode.startsWith('shape-');
    // Highlight rail tiles matching the active mode (or shapes group)
    this.rootEl.querySelectorAll<HTMLElement>('.rp-ie-tile').forEach((t) => {
      const mode = t.dataset.mode as EditorMode | undefined;
      const railId = t.dataset.railId;
      const isActive =
        mode === activeMode ||
        (railId === 'shapes' && isShape) ||
        (railId === 'select' && activeMode === 'move');
      t.classList.toggle('rp-ie-tile--active', !!isActive);
      t.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    this.rootEl.querySelectorAll<HTMLElement>('.rp-ie-quickaction').forEach((t) => {
      const mode = t.dataset.mode as EditorMode | undefined;
      const isActive =
        mode === activeMode ||
        (t.dataset.quickId === 'select' && activeMode === 'move');
      t.classList.toggle('rp-ie-quickaction--active', !!isActive);
    });
  }

  private updateHistoryButtons(): void {
    if (!this.rootEl) return;
    this.rootEl
      .querySelectorAll<HTMLElement>('[data-history-role="undo"]')
      .forEach((el) => {
        el.toggleAttribute('disabled', !this.canUndo);
        el.classList.toggle('rp-ie-disabled', !this.canUndo);
      });
    this.rootEl
      .querySelectorAll<HTMLElement>('[data-history-role="redo"]')
      .forEach((el) => {
        el.toggleAttribute('disabled', !this.canRedo);
        el.classList.toggle('rp-ie-disabled', !this.canRedo);
      });
  }

  private setDisabledState(quickId: string, enabled: boolean): void {
    if (!this.rootEl) return;
    this.rootEl
      .querySelectorAll<HTMLElement>(`[data-quick-id="${quickId}"]`)
      .forEach((el) => {
        el.toggleAttribute('disabled', !enabled);
        el.classList.toggle('rp-ie-disabled', !enabled);
      });
  }

  private updateZoomLabel(): void {
    const pct = `${Math.round(this.zoomLevel * 100)}%`;
    if (this.zoomLabelEl) this.zoomLabelEl.textContent = pct;
    if (this.statusLiveEl) this.statusLiveEl.textContent = `Zoom ${pct}`;
  }

  private handleFit(): void {
    if (this.callbacks.onFitZoom) this.callbacks.onFitZoom();
    else this.callbacks.onZoomTo?.(1);
  }

  private makeIconButton(opts: {
    icon: string;
    label: string;
    shortcut?: string;
    onClick: () => void;
    dataAttr?: Record<string, string>;
  }): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rp-ie-iconbtn';
    btn.setAttribute('aria-label', opts.label);
    btn.innerHTML = `<span class="rp-ie-icon">${ICONS[opts.icon] || ''}</span>`;
    if (opts.dataAttr) {
      for (const [k, v] of Object.entries(opts.dataAttr)) btn.dataset[k] = v;
    }
    const tip = opts.shortcut ? `${opts.label} · ${opts.shortcut}` : opts.label;
    this.attachTooltip(btn, tip);
    btn.addEventListener('click', opts.onClick);
    return btn;
  }

  private attachTooltip(
    el: HTMLElement,
    text: string,
    _placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
  ): void {
    el.setAttribute('title', text);
    el.setAttribute('data-rp-tip', text);
  }

  /**
   * Swap the fullscreen button's icon and tooltip to reflect the
   * current `document.fullscreenElement` state. Called on click and
   * on `fullscreenchange` (covers Esc-to-exit).
   */
  private refreshFullscreenButton(): void {
    const btn = this.fullscreenBtnEl;
    if (!btn) return;
    const isFs = !!document.fullscreenElement;
    const label = isFs ? 'Exit Fullscreen' : 'Fullscreen';
    const icon = isFs ? ICONS.fullscreenExit : ICONS.fullscreen;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('data-rp-tip', label);
    btn.innerHTML = `<span class="rp-ie-icon">${icon || ''}</span>`;
  }
}
