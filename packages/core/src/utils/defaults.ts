import { RpEditorConfig, CropAspectRatio } from '../types/index.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<RpEditorConfig, 'maxResolution' | 'locale' | 'theme'>
> & { maxResolution: number | null; theme: NonNullable<RpEditorConfig['theme']> } = {
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
  theme: {
    headerBackground: '#f5f5f5',
    headerTextColor: '#222222',
    headerTitle: 'Photo Editor',
    editorBackground: '#e0e0e0',
    toolbarBackground: '#fafafa',
    toolbarIconColor: '#333333',
    toolbarActiveIconColor: '#1976d2',
    footerBackground: '#f5f5f5',
    cancelButtonBackground: 'transparent',
    cancelButtonTextColor: '#333333',
    cancelButtonBorderColor: '#999999',
    cancelButtonText: 'Close',
    applyButtonBackground: '#1976d2',
    applyButtonTextColor: '#ffffff',
    applyButtonBorderColor: '#1976d2',
    applyButtonText: 'Apply',
    modalBorderRadius: '12px',
    buttonBorderRadius: '6px',
  },
};

/**
 * Parse a CSS color string into RGB. Supports #rgb, #rrggbb, and rgb()/rgba().
 * Returns null when the color can't be parsed (e.g. named colors, hsl()).
 */
function parseColor(input: string): { r: number; g: number; b: number } | null {
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
  const mergedTheme = {
    ...DEFAULT_CONFIG.theme,
    ...userTheme,
  };

  // Background → foreground pairs to auto-balance. Only kicks in when the
  // caller set the background but left the paired foreground undefined.
  const pairs: Array<[bgKey: keyof typeof mergedTheme, fgKey: keyof typeof mergedTheme]> = [
    ['headerBackground', 'headerTextColor'],
    ['toolbarBackground', 'toolbarIconColor'],
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
