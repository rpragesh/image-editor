/**
 * @rageshpikalmunde/rp-image-editor
 * Lightweight image editor with crop, zoom, rotate, draw, text, eraser, undo/redo
 */

// Core editor
export { RpImageEditor } from './editor.js';

// Modal helper
export { openEditorModal } from './modal.js';
export type { ModalOptions } from './modal.js';

// Types
export type {
  RpEditorConfig,
  RpEditorTheme,
  RpEditorResult,
  CropAspectRatio,
  EditorMode,
  ShapeType,
  RpEditorEvents,
  LoadedImageInfo,
} from './types/index.js';

// i18n (locale packs)
export { getLocalePack, resolveLanguage } from './i18n/index.js';
export type { LanguageCode, LocalePack, LocalePackOverrides } from './i18n/index.js';

// Utils (for advanced users)
export { processImage, isHeicFile } from './utils/image-processing.js';
export { isIOS, isSafari, isCapacitor, isTouchDevice, getMaxResolution } from './utils/platform.js';
export { mergeConfig, DEFAULT_CONFIG } from './utils/defaults.js';
