/**
 * i18n locale pack contract.
 *
 * A `LocalePack` provides the complete set of user-facing strings the
 * editor renders in its shell (top bar, rails, empty state, props
 * panel, filter tiles, callout defaults, etc.).
 *
 * Consumers select a pack by passing `RpEditorConfig.language`.
 * English is the fallback when the code is missing or unknown.
 *
 * IMPORTANT: any per-key string a consumer sets explicitly on
 * `theme`, `strings`, `filterPresetLabels`, or `calloutDefaults`
 * takes precedence over the locale pack — the pack only fills gaps.
 */

/** Supported ISO 639-1 language codes. `sp` is accepted as an alias for `es`. */
export type LanguageCode =
  | 'da'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'it'
  | 'ko'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'sv'
  | 'th'
  | 'tr'
  | 'vi'
  | 'zh';

/** Shape of a translation pack. */
export interface LocalePack {
  /* ----- Header / chrome ----- */
  headerTitle: string;
  headerSubtitle: string;
  applyButton: string;
  cancelButton: string;
  undo: string;
  redo: string;
  fullscreen: string;
  fit: string;
  zoomTooltip: string;

  /* ----- Empty state ----- */
  emptyStateTitle: string;
  emptyStateSubtitle: string;

  /* ----- Callout default text ----- */
  calloutLabelText: string;

  /* ----- Tool names (rails + bottom bar) ----- */
  tool: {
    select: string;
    crop: string;
    draw: string;
    eraser: string;
    text: string;
    shapes: string;
    callout: string;
    filters: string;
    adjust: string;
    move: string;
    pen: string;
    zoom: string;
    zoomIn: string;
    zoomOut: string;
    rotateLeft: string;
    rotateRight: string;
    flipH: string;
    flipV: string;
    reset: string;
  };

  /* ----- Shape names ----- */
  shape: {
    circle: string;
    ellipse: string;
    square: string;
    rectangle: string;
    arrow: string;
    polyline: string;
  };

  /* ----- Filter preset labels ----- */
  filter: {
    none: string;
    grayscale: string;
    sepia: string;
    vintage: string;
    cool: string;
    warm: string;
    invert: string;
  };

  /* ----- Properties panel ----- */
  props: {
    /** Header labels for the contextual props panel. */
    title: {
      draw: string;
      eraser: string;
      text: string;
      crop: string;
      shapes: string;
      callout: string;
      filters: string;
      adjust: string;
      move: string;
    };
    aspectRatio: string;
    applyCrop: string;
    cancel: string;
    shape: string;
    preset: string;
    resetEffects: string;
    resetAdjustments: string;
    deleteSelected: string;
    colors: string;
    recent: string;
    customColor: string;
    brushSize: string;
    strokeWidth: string;
    opacity: string;
    eraserSize: string;
    fontSize: string;
    brightness: string;
    contrast: string;
    saturation: string;
    blur: string;
    quickActions: string;
    hintMove: string;
    hintEraser: string;
  };
}

/**
 * Deep-partial version of {@link LocalePack} used by `RpEditorConfig.labels`.
 *
 * Consumers can supply any subset of keys to override individual strings on
 * top of the pack resolved by `language`. Missing keys fall through to the
 * language pack (which itself falls back to English).
 *
 * Also enables translations for languages not in the built-in `LanguageCode`
 * set: pass a full `labels` object with no `language`, and the editor will
 * layer your strings over the English pack.
 */
export type LocalePackOverrides = {
  [K in keyof LocalePack]?: LocalePack[K] extends object
    ? { [P in keyof LocalePack[K]]?: LocalePack[K][P] extends object
        ? { [Q in keyof LocalePack[K][P]]?: LocalePack[K][P][Q] }
        : LocalePack[K][P] }
    : LocalePack[K];
};
