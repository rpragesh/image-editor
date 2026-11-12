import { useCallback } from 'react';
import {
  RpEditorConfig,
  RpEditorResult,
  RpMultiEditorItemResult,
  openEditorModal,
  openMultiEditorModal,
} from '@rageshpikalmunde/rp-image-editor';

/**
 * React hook to open the image editor as a modal overlay
 * (`openEditor` for one image, `openMultiEditor` for several).
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { openEditor } = useRpImageEditor();
 *
 *   const handleEdit = async (file: File) => {
 *     const result = await openEditor(file, {
 *       theme: { applyButtonBackground: '#28a745' }
 *     });
 *     if (result) {
 *       console.log(result.file); // upload
 *     }
 *   };
 * }
 * ```
 */
export function useRpImageEditor() {
  const openEditor = useCallback(
    async (
      image: File | Blob | string,
      config?: Partial<RpEditorConfig>
    ): Promise<RpEditorResult | null> => {
      return openEditorModal({ image, config });
    },
    []
  );

  const openMultiEditor = useCallback(
    async (
      images: Array<File | Blob | string>,
      config?: Partial<RpEditorConfig>,
      startIndex?: number
    ): Promise<RpMultiEditorItemResult[] | null> => {
      return openMultiEditorModal({ images, config, startIndex });
    },
    []
  );

  return { openEditor, openMultiEditor };
}
