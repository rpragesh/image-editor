/**
 * @rageshpikalmunde/rp-image-editor-react
 * React wrapper for the rp-image-editor plugin
 */

// Component
export { RpImageEditorComponent } from './RpImageEditor';
export type { RpImageEditorProps } from './RpImageEditor';

// Hook
export { useRpImageEditor } from './useRpImageEditor';

// Re-export types from core
export type {
  RpEditorConfig,
  RpEditorTheme,
  RpEditorResult,
  RpMultiEditorItemResult,
  CropAspectRatio,
  EditorMode,
} from '@rageshpikalmunde/rp-image-editor';
