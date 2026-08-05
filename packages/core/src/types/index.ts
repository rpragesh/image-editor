// Re-exported from the i18n barrel so consumers can use the union
// directly on `RpEditorConfig.language`. Kept as a type-only import
// so the runtime bundle stays untouched.
import type { LanguageCode, LocalePackOverrides } from '../i18n/types.js';

/**
 * Configuration for the image editor
 */
export interface RpEditorConfig {
  /** Maximum resolution (longest side). null = no limit (auto-detect per platform) */
  maxResolution?: number | null;

  /** Default crop aspect ratios available to user */
  cropAspectRatios?: CropAspectRatio[];

  /** Default export format */
  exportFormat?: 'png' | 'jpeg';

  /** JPEG export quality (0.0 - 1.0). Default: 0.92 */
  exportQuality?: number;

  /** Export pixel ratio. 1 = standard, 2 = retina. Default: 1 */
  exportPixelRatio?: number;

  /**
   * When true (default), the exported image is rendered at the native
   * (intrinsic) resolution of the loaded image — so the on-screen
   * scaling that the editor applies to fit the canvas does NOT reduce
   * the resolution of the output. Annotations are upscaled to match.
   *
   * Set to false to revert to the legacy behaviour where the export
   * size matches the on-screen canvas size.
   * Default: true
   */
  exportAtNativeResolution?: boolean;

  /** Maximum undo stack depth. Default: 20 */
  maxUndoSteps?: number;

  /** Default brush color. Default: '#ff0000' */
  defaultBrushColor?: string;

  /** Default brush width in pixels. Default: 3 */
  defaultBrushWidth?: number;

  /** Default text color. Default: '#ff0000' */
  defaultTextColor?: string;

  /** Default text font size. Default: 24 */
  defaultTextFontSize?: number;

  /** Default stroke color for shapes (circle/ellipse/square/rectangle/arrow). Default: matches defaultBrushColor */
  defaultShapeColor?: string;

  /** Default stroke width for shapes. Default: 3 */
  defaultShapeStrokeWidth?: number;

  /** Color palette for the color picker */
  colorPalette?: string[];

  /** Whether to show the built-in toolbar. Default: true */
  showToolbar?: boolean;

  /**
   * Current image position in a multi-image editing flow.
   * 1-based index (for example: 1, 2, 3...).
   *
   * When used together with `totalImages`, the editor header shows
   * a compact `current/total` indicator (e.g. `2/5`).
   */
  currentImageIndex?: number;

  /**
   * Total number of images in a multi-image editing flow.
   *
   * When used together with `currentImageIndex`, the editor header
   * shows a compact `current/total` indicator.
   */
  totalImages?: number;

  /**
   * Features to hide from the toolbar.
   * Accepts individual tool names: 'move','crop','zoomIn','zoomOut','rotateLeft','rotateRight',
   * 'draw','text','eraser','callout','undo','redo','reset','filters','adjust','fullscreen'
   * Or group names: 'zoom' (zoomIn+zoomOut), 'transform' (rotateLeft+rotateRight+reset),
   * 'annotate' (draw+text+callout+eraser)
   * Default: [] (all features visible)
   */
  disabledFeatures?: string[];

  /**
   * Whitelist and ordering of built-in one-click filter presets shown
   * in the Filters tool's tile grid. When set, only listed presets
   * render, in the given order. When unset (default), all seven
   * built-in presets render in their canonical order.
   *
   * Note: this only picks from the built-in set (see `ImageFilterPreset`);
   * it does not let you define new filter algorithms.
   */
  filterPresets?: import('./index.js').ImageFilterPreset[] | undefined;

  /**
   * Rename individual filter preset tiles without changing behaviour.
   * Keys not present here fall back to the built-in English label.
   *
   * Example:
   * ```ts
   * filterPresetLabels: { grayscale: 'Mono', sepia: 'Warm Vintage' }
   * ```
   */
  filterPresetLabels?: Partial<Record<import('./index.js').ImageFilterPreset, string>>;

  /**
   * Defaults applied to newly-placed callouts. All keys are optional;
   * omitted keys fall back to the current built-in defaults.
   *
   *  - `text` — initial label text (default `'Label'`).
   *  - `color` — callout box background color. Falls back to
   *    `defaultBrushColor`.
   *  - `textColor` — label text color (default `'#ffffff'`).
   *  - `fontSize` — label font size in pixels (default `20`).
   *  - `maxChars` — maximum characters allowed in the label
   *    (default `40`).
   *  - `lineBreakAt` — character position around which to insert an
   *    automatic line break (default `15`).
   */
  calloutDefaults?: {
    text?: string;
    color?: string;
    textColor?: string;
    fontSize?: number;
    maxChars?: number;
    lineBreakAt?: number;
  };

  /**
   * User-facing strings rendered by the editor shell. All keys are
   * optional; omitted keys fall back to the built-in English text.
   * Pass an empty string (`''`) to hide the corresponding UI element
   * entirely (currently supported for `emptyStateSubtitle`).
   */
  strings?: {
    /** Default: `'Drop an image or click to upload'` */
    emptyStateTitle?: string;
    /** Default: `'Supported: PNG, JPEG, HEIC'`. Pass `''` to hide the row. */
    emptyStateSubtitle?: string;
  };

  /** Theme customization */
  theme?: RpEditorTheme;

  /** Locale for button text. Can override individual labels via theme */
  locale?: string;

  /**
   * Two-letter language code that selects a bundled translation pack
   * for every user-facing string in the editor shell (top bar,
   * rails, empty state, props panel, filter tiles, callout defaults).
   *
   * Supported: `da, de, en, es, fr, it, ko, nl, pl, pt, sv, th, tr, vi, zh`.
   * `sp` is accepted as an alias for `es`. Regional variants such as
   * `de-DE` or `pt_BR` are folded to their primary tag.
   *
   * Any individual label you set explicitly on `theme`, `strings`,
   * `filterPresetLabels`, or `calloutDefaults` **overrides** the
   * language pack for that key. Unknown or missing codes fall back
   * to English.
   *
   * Example:
   * ```ts
   * openEditorModal({
   *   image: file,
   *   config: {
   *     language: 'de',                       // whole UI in German
   *     theme: { headerTitle: 'Foto Studio' } // this one label stays custom
   *   },
   * });
   * ```
   */
  language?: LanguageCode;

  /**
   * Per-key overrides for the resolved locale pack. Deep-partial: pass
   * any subset of `LocalePack` keys and only those strings are replaced.
   *
   * Precedence (lowest → highest):
   *   1. English pack (built-in fallback)
   *   2. Language pack selected via `language` (if any)
   *   3. `labels` overrides passed here
   *   4. Explicit fields on `theme`, `strings`, `filterPresetLabels`,
   *      and `calloutDefaults` (highest priority)
   *
   * Use cases:
   *   - Rebrand a single label (e.g. rename "Callout" to "Annotation").
   *   - Provide a full translation for a language not in the built-in
   *     `LanguageCode` set — pass a complete `labels` object with no
   *     `language`, and the missing keys fall back to English.
   *   - Mix and match: `language: 'de'` plus a few tweaks.
   *
   * Example:
   * ```ts
   * openEditorModal({
   *   image: file,
   *   config: {
   *     language: 'en',
   *     labels: {
   *       tool: { callout: 'Annotation' },
   *       props: { title: { callout: 'Annotation' }, deleteSelected: 'Remove' },
   *     },
   *   },
   * });
   * ```
   */
  labels?: LocalePackOverrides;

  /**
   * When true, the editor will NOT install keyboard shortcuts (V/C/B/E/T/S,
   * ⌘Z/⌘⇧Z, +/-/0/1, ⌘⏎/Esc, R/⇧R, H/⇧H). Additive; default false.
   */
  disableKeyboardShortcuts?: boolean;

  /**
   * Optional callback wired to the shell's primary Apply button in the
   * top bar. When provided the button is rendered; when omitted it is
   * hidden. Used by `openEditorModal` to bridge the modal's promise.
   * Additive — inline (non-modal) consumers can ignore this.
   */
  onApply?: () => void;

  /**
   * Optional callback wired to the shell's Close button in the top bar.
   * When omitted, the Close button is hidden.
   */
  onClose?: () => void;

  /**
   * Fired once the image has finished loading (after HEIC decode,
   * EXIF orientation correction, and any downscaling). Additive
   * mirror of the `image:loaded` event on the editor instance — use
   * this from modal consumers who don't have a reference to the
   * `RpImageEditor` instance.
   */
  onImageLoaded?: (info: {
    width: number;
    height: number;
    downscaled: boolean;
  }) => void;

  /**
   * Fired for non-fatal editor errors (e.g. bad file, HEIC decode
   * failure, resolution exceeded). Additive mirror of the `error`
   * event on the editor instance.
   */
  onError?: (error: Error) => void;

  /**
   * Fired whenever the active tool changes. Additive mirror of the
   * `mode:changed` event on the editor instance.
   */
  onModeChanged?: (mode: EditorMode) => void;
}

/**
 * Theme customization for the editor modal
 */
export interface RpEditorTheme {
  // Modal header
  headerBackground?: string;
  headerTextColor?: string;
  headerTitle?: string;
  /**
   * Optional image URL (or data URI) rendered inside the header badge,
   * to the left of `headerTitle`. Use this to show your product/brand
   * logo. Any square image works best; it is rendered at ~24×24 CSS px
   * inside the badge with `object-fit: contain`, so a 16×16, 24×24 or
   * larger source image will all look correct.
   *
   * When unset, the built-in editor icon is used.
   */
  headerLogo?: string;

  /**
   * Optional subtitle text rendered under `headerTitle`.
   * Defaults to `'Edit your image with ease'`. Pass an empty string
   * (`''`) to hide the subtitle row entirely.
   */
  headerSubtitle?: string;

  /**
   * Whether to show the square badge (logo/icon) to the left of the
   * header title. Defaults to `true`. Set to `false` to hide the
   * badge and reclaim horizontal space in the top bar.
   */
  showHeaderBadge?: boolean;

  /**
   * Size in CSS pixels of the header badge square (the container
   * around the logo/icon). Defaults to `40`. Ignored when the badge
   * is hidden via `showHeaderBadge: false`.
   */
  headerBadgeSize?: number;

  /**
   * Size in CSS pixels of the logo / built-in icon rendered inside
   * the header badge. Defaults to `24` (custom logo image) or `22`
   * (built-in icon). When set, both variants use this value.
   */
  headerLogoSize?: number;

  // Editor body
  editorBackground?: string;
  toolbarBackground?: string;
  toolbarIconColor?: string;
  /**
   * Background color of the selected/active toolbar button.
   * Defaults to `#1976d2`. Choose a color with strong contrast against
   * `toolbarBackground` so users can clearly see the current selection.
   */
  toolbarActiveBackground?: string;
  /**
   * Icon/text color used inside the active toolbar button.
   * Defaults to `#ffffff`. If left unset while `toolbarActiveBackground`
   * is customized, a readable foreground is auto-derived from the
   * background luminance.
   */
  toolbarActiveTextColor?: string;
  /**
   * @deprecated Use `toolbarActiveBackground` instead. Retained for
   * backward compatibility — when set, it is used as the active
   * button background if `toolbarActiveBackground` is not provided.
   */
  toolbarActiveIconColor?: string;

  // Footer
  footerBackground?: string;

  // Cancel button
  cancelButtonBackground?: string;
  cancelButtonTextColor?: string;
  cancelButtonBorderColor?: string;
  cancelButtonText?: string;

  // Apply button
  applyButtonBackground?: string;
  applyButtonTextColor?: string;
  applyButtonBorderColor?: string;
  applyButtonText?: string;

  // Border radii
  modalBorderRadius?: string;
  buttonBorderRadius?: string;

  /**
   * Maximum width of the modal frame. Any valid CSS length is
   * accepted (e.g. `'1400px'`, `'80vw'`, `'min(90vw, 1400px)'`).
   * Defaults to `'1200px'`. Only applies when the editor is
   * launched via `openEditorModal`.
   */
  modalMaxWidth?: string;

  /**
   * Height of the modal frame. Any valid CSS length is accepted
   * (e.g. `'720px'`, `'85vh'`, `'min(92vh, 900px)'`). Defaults to
   * `'min(92vh, 820px)'`. Only applies when the editor is launched
   * via `openEditorModal`.
   */
  modalHeight?: string;

  /* ─────────────────────────────────────────────────────────────
   * NEW additive tokens (Figma + Linear design direction).
   * All are optional and default to values baked into the shell
   * CSS. Adding these does NOT break existing consumers who only
   * set the legacy keys above — the shell reads legacy first when
   * present and falls back to the new tokens otherwise.
   * ─────────────────────────────────────────────────────────── */

  /** Overall variant. When 'light', the shell swaps to the light palette. */
  variant?: 'dark' | 'light';

  /** App-level background (behind panels). Maps to `--rp-ie-surface-0`. */
  surface0?: string;
  /** Panel background. Maps to `--rp-ie-surface-1`. */
  surface1?: string;
  /** Elevated / active surface. Maps to `--rp-ie-surface-2`. */
  surface2?: string;

  /** Hairline border color. Maps to `--rp-ie-border`. */
  borderColor?: string;

  /** Primary text color. Maps to `--rp-ie-text`. */
  textPrimary?: string;
  /** Muted / secondary text color. Maps to `--rp-ie-text-muted`. */
  textMuted?: string;

  /**
   * Accent color used for the primary CTA, active tool tile, and focus
   * ring. Maps to `--rp-ie-accent`. Falls back to
   * `toolbarActiveBackground` when unset for back-compat.
   */
  accent?: string;
  /** Contrast color painted on top of `accent`. Maps to `--rp-ie-accent-contrast`. */
  accentContrast?: string;
}

/**
 * Predefined crop aspect ratio
 */
export interface CropAspectRatio {
  label: string;
  value: number | null; // null = free crop
}

/**
 * Result returned after editing
 */
export interface RpEditorResult {
  /** Base64 data URL (data:image/png;base64,... or data:image/jpeg;base64,...) */
  base64: string;
  /** Binary blob */
  blob: Blob;
  /** File object (uploadable via FormData) */
  file: File;
  /** Output width in pixels */
  width: number;
  /** Output height in pixels */
  height: number;
  /** Output format */
  format: 'png' | 'jpeg';
}

/**
 * Editor tool modes
 */
export type EditorMode =
  | 'move'
  | 'crop'
  | 'draw'
  | 'text'
  | 'eraser'
  | 'callout'
  | 'shape-circle'
  | 'shape-ellipse'
  | 'shape-square'
  | 'shape-rectangle'
  | 'shape-arrow'
  | 'shape-polyline'
  | 'filters'
  | 'adjust';

/**
 * Names of the one-click color filters bundled with the editor.
 * Applied non-destructively on top of the base image via Fabric's
 * `fabric.Image.filters` pipeline.
 */
export type ImageFilterPreset =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'vintage'
  | 'cool'
  | 'warm'
  | 'invert';

/**
 * Live adjust knobs. Each ranges roughly `-1..1` (or `0..1` for blur).
 * Zero means "no effect".
 */
export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

/** Shape primitive supported by the ShapeModule */
export type ShapeType = 'circle' | 'ellipse' | 'square' | 'rectangle' | 'arrow' | 'polyline';

/**
 * Event types emitted by the editor
 */
export type RpEditorEvents = {
  [key: string]: (...args: any[]) => void;
  'mode:changed': (mode: EditorMode) => void;
  'zoom:changed': (level: number) => void;
  'history:changed': (state: { canUndo: boolean; canRedo: boolean }) => void;
  'image:loaded': (info: { width: number; height: number; downscaled: boolean }) => void;
  'image:exported': (result: RpEditorResult) => void;
  'error': (error: Error) => void;
}

/**
 * Internal image info after loading pipeline
 */
export interface LoadedImageInfo {
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  wasDownscaled: boolean;
  wasHeicConverted: boolean;
  wasExifCorrected: boolean;
  format: string;
}
