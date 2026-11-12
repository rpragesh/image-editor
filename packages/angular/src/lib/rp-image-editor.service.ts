import { Injectable } from '@angular/core';
import {
  RpEditorConfig,
  RpEditorResult,
  RpMultiEditorItemResult,
  openEditorModal,
  openMultiEditorModal,
} from '@rageshpikalmunde/rp-image-editor';

/**
 * Service to open the image editor as a modal overlay.
 * Works with or without Ionic — uses the core modal implementation.
 *
 * Usage:
 * ```ts
 * constructor(private rpEditor: RpImageEditorService) {}
 *
 * async editImage(file: File) {
 *   const result = await this.rpEditor.openEditor(file, {
 *     theme: { applyButtonBackground: '#28a745' }
 *   });
 *   if (result) {
 *     // result.file — upload to server
 *     // result.base64 — preview
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class RpImageEditorService {
  /**
   * Open the image editor in a modal popup.
   *
   * @param image - File, Blob, or URL string to edit
   * @param config - Optional editor configuration (theme, crop ratios, etc.)
   * @returns Promise resolving to RpEditorResult if applied, or null if cancelled
   */
  async openEditor(
    image: File | Blob | string,
    config?: Partial<RpEditorConfig>
  ): Promise<RpEditorResult | null> {
    return openEditorModal({
      image,
      config,
    });
  }

  /**
   * Edit several images in one modal with a thumbnail strip.
   *
   * @param images - Files, Blobs or URL strings, in strip order
   * @param config - Editor configuration shared by every image
   * @param startIndex - 0-based index of the image to open first
   * @returns One `{ index, edited, result }` per image on Apply, or null if closed
   */
  async openMultiEditor(
    images: Array<File | Blob | string>,
    config?: Partial<RpEditorConfig>,
    startIndex?: number
  ): Promise<RpMultiEditorItemResult[] | null> {
    return openMultiEditorModal({ images, config, startIndex });
  }
}
