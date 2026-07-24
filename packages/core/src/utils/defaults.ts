import { RpEditorConfig, CropAspectRatio } from '../types/index.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<
    RpEditorConfig,
    | 'maxResolution'
    | 'locale'
    | 'language'
    | 'labels'
    | 'theme'
    | 'onApply'
    | 'onClose'
    | 'filterPresets'
    | 'filterPresetLabels'
    | 'onImageLoaded'
    | 'onError'
    | 'onModeChanged'
    | 'calloutDefaults'
    | 'strings'
  >
> & {
  maxResolution: number | null;
  theme: NonNullable<RpEditorConfig['theme']>;
  onApply?: () => void;
  onClose?: () => void;
  filterPresets?: RpEditorConfig['filterPresets'];
  filterPresetLabels?: RpEditorConfig['filterPresetLabels'];
  onImageLoaded?: RpEditorConfig['onImageLoaded'];
  onError?: RpEditorConfig['onError'];
  onModeChanged?: RpEditorConfig['onModeChanged'];
  calloutDefaults?: RpEditorConfig['calloutDefaults'];
  strings?: RpEditorConfig['strings'];
  language?: RpEditorConfig['language'];
  labels?: RpEditorConfig['labels'];
} = {
  maxResolution: null, // auto-detect
  cropAspectRatios: [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
    { label: '3:4', value: 3 / 4 },
    { label: '2:3', value: 2 / 3 },
    { label: '9:16', value: 9 / 16 },
  ],
  exportFormat: 'png',
  exportQuality: 0.92,
  exportPixelRatio: 1,
  exportAtNativeResolution: true,
  maxUndoSteps: 20,
  defaultBrushColor: '#ff0000',
  defaultBrushWidth: 3,
  defaultTextColor: '#ff0000',
  defaultTextFontSize: 24,
  defaultShapeColor: '#ff0000',
  defaultShapeStrokeWidth: 3,
  colorPalette: [
    '#000000', '#ffffff', '#ff0000', '#0066ff',
    '#00cc44', '#ffcc00', '#ff6600', '#9933ff',
    '#ff69b4', '#00cccc',
  ],
  showToolbar: true,
  disabledFeatures: [],
  disableKeyboardShortcuts: false,
  theme: {
    headerBackground: '#0B0D12',
    headerTextColor: '#ECEEF3',
    // headerTitle intentionally omitted so the i18n locale pack can fill it.
    editorBackground: '#0B0D12',
    toolbarBackground: '#12151C',
    toolbarIconColor: '#ECEEF3',
    toolbarActiveBackground: '#083a81',
    toolbarActiveTextColor: '#FFFFFF',
    toolbarActiveIconColor: '#083a81',
    footerBackground: '#0B0D12',
    cancelButtonBackground: 'transparent',
    cancelButtonTextColor: '#ECEEF3',
    cancelButtonBorderColor: 'rgba(255,255,255,0.14)',
    // cancelButtonText intentionally omitted (see i18n locale pack).
    applyButtonBackground: '#083a81',
    applyButtonTextColor: '#FFFFFF',
    applyButtonBorderColor: '#083a81',
    // applyButtonText intentionally omitted (see i18n locale pack).
    modalBorderRadius: '16px',
    buttonBorderRadius: '10px',
    // New Figma+Linear tokens (dark palette)
    variant: 'dark',
    surface0: '#0B0D12',
    surface1: '#12151C',
    surface2: '#181C25',
    borderColor: 'rgba(255,255,255,0.06)',
    textPrimary: '#ECEEF3',
    textMuted: '#8A93A6',
    accent: '#083a81',
    accentContrast: '#FFFFFF',
  },
};

/**
 * Parse a CSS color string into RGB. Supports #rgb, #rrggbb, and rgb()/rgba().
 * Returns null when the color can't be parsed (e.g. named colors, hsl()).
 */
export function parseColor(input: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  // #rgb / #rrggbb
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b };
    }
    return null;
  }

  // rgb(r,g,b) / rgba(r,g,b,a)
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  }

  return null;
}

/**
 * Relative luminance per WCAG 2.x. Returns a value in [0, 1].
 */
function relativeLuminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/**
 * Pick a readable foreground (#ffffff on dark bg, #222222 on light bg) for a
 * given background. Returns `fallback` when the background can't be parsed.
 */
function pickReadableForeground(bg: string | undefined, fallback: string): string {
  if (!bg) return fallback;
  const lum = relativeLuminance(bg);
  if (lum == null) return fallback;
  // Threshold ~0.5 keeps mid-grey on the dark side, which matches our
  // toolbar use cases (dark grey toolbars get white icons).
  return lum < 0.5 ? '#ffffff' : '#222222';
}

/**
 * Deep merge configuration with defaults.
 *
 * When a caller customizes a background color (e.g. `toolbarBackground`) but
 * does NOT also supply the paired foreground (e.g. `toolbarIconColor`), the
 * default foreground from the light theme would silently bleed through and
 * become unreadable. To avoid that, we auto-derive a contrasting foreground
 * from the supplied background using WCAG relative luminance.
 */
export function mergeConfig(userConfig?: Partial<RpEditorConfig>): typeof DEFAULT_CONFIG & RpEditorConfig {
  if (!userConfig) {
    return { ...DEFAULT_CONFIG };
  }

  const userTheme = userConfig.theme || {};

  // When the caller opts into the light variant, seed the merged theme with a
  // light-palette baseline instead of the dark defaults. Otherwise the dark
  // token values from DEFAULT_CONFIG.theme would be written as inline styles
  // in `applyThemeVars` and shadow the CSS light palette activated by
  // `data-theme="light"`, leaving the modal visually dark.
  const baseTheme =
    userTheme.variant === 'light'
      ? {
          ...DEFAULT_CONFIG.theme,
          headerBackground: '#FFFFFF',
          headerTextColor: '#12151C',
          editorBackground: '#F7F8FA',
          toolbarBackground: '#FFFFFF',
          toolbarIconColor: '#12151C',
          footerBackground: '#FFFFFF',
          cancelButtonTextColor: '#12151C',
          cancelButtonBorderColor: 'rgba(15,20,30,0.14)',
          surface0: '#F7F8FA',
          surface1: '#FFFFFF',
          surface2: '#F1F3F7',
          borderColor: 'rgba(15,20,30,0.08)',
          textPrimary: '#12151C',
          textMuted: '#5B6472',
          variant: 'light' as const,
        }
      : DEFAULT_CONFIG.theme;

  const mergedTheme = {
    ...baseTheme,
    ...userTheme,
  };

  // Legacy alias: `toolbarActiveIconColor` used to represent the active
  // button background. If the caller only provided the old prop, promote
  // it to the new `toolbarActiveBackground` so both stay in sync.
  if (userTheme.toolbarActiveIconColor && userTheme.toolbarActiveBackground == null) {
    mergedTheme.toolbarActiveBackground = userTheme.toolbarActiveIconColor;
  }
  // And vice-versa — keep the legacy field mirrored so any downstream
  // consumers reading it still get a sensible value.
  if (userTheme.toolbarActiveBackground && userTheme.toolbarActiveIconColor == null) {
    mergedTheme.toolbarActiveIconColor = userTheme.toolbarActiveBackground;
  }

  // Mirror legacy → new design tokens. `applyThemeVars` always writes the
  // new tokens as inline styles, so if the user only provides legacy keys
  // (e.g. `editorBackground`) without the corresponding new token
  // (`surface0`), the default dark token bleeds through and overrides the
  // legacy value. Promote legacy values into the new tokens when the new
  // one wasn't explicitly set by the caller.
  if (userTheme.editorBackground && userTheme.surface0 == null) {
    mergedTheme.surface0 = userTheme.editorBackground;
  }
  if (userTheme.toolbarBackground && userTheme.surface1 == null) {
    mergedTheme.surface1 = userTheme.toolbarBackground;
    // surface2 (elevated / active) also derives from the toolbar surface
    // when not explicitly customized, so hover / active tiles inherit the
    // caller's palette instead of the dark default.
    if (userTheme.surface2 == null) {
      mergedTheme.surface2 = userTheme.toolbarBackground;
    }
  }
  if (userTheme.toolbarIconColor && userTheme.textPrimary == null) {
    mergedTheme.textPrimary = userTheme.toolbarIconColor;
  } else if (userTheme.headerTextColor && userTheme.textPrimary == null) {
    mergedTheme.textPrimary = userTheme.headerTextColor;
  }

  // Background → foreground pairs to auto-balance. Only kicks in when the
  // caller set the background but left the paired foreground undefined.
  const pairs: Array<[bgKey: keyof typeof mergedTheme, fgKey: keyof typeof mergedTheme]> = [
    ['headerBackground', 'headerTextColor'],
    ['toolbarBackground', 'toolbarIconColor'],
    ['toolbarActiveBackground', 'toolbarActiveTextColor'],
    ['footerBackground', 'cancelButtonTextColor'],
  ];
  for (const [bgKey, fgKey] of pairs) {
    if (userTheme[bgKey] && userTheme[fgKey] == null) {
      mergedTheme[fgKey] = pickReadableForeground(
        userTheme[bgKey] as string,
        mergedTheme[fgKey] as string,
      ) as never;
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    theme: mergedTheme,
    cropAspectRatios: userConfig.cropAspectRatios || DEFAULT_CONFIG.cropAspectRatios,
    colorPalette: userConfig.colorPalette || DEFAULT_CONFIG.colorPalette,
  };
}
