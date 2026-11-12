/**
 * @rageshpikalmunde/rp-image-editor-angular
 * Angular wrapper for the rp-image-editor plugin
 */

// Module
export { RpImageEditorModule } from './lib/rp-image-editor.module';

// Component
export { RpImageEditorComponent } from './lib/rp-image-editor.component';

// Service
export { RpImageEditorService } from './lib/rp-image-editor.service';

// Re-export types from core
export type {
  RpEditorConfig,
  RpEditorTheme,
  RpEditorResult,
  RpMultiEditorItemResult,
  CropAspectRatio,
  EditorMode,
} from '@rageshpikalmunde/rp-image-editor';
