/**
 * Modal helper — thin backdrop + container that mounts the editor
 * shell full-screen. The shell owns the entire chrome (top bar,
 * rails, bottom bar) including Apply and Close, so the modal no
 * longer renders a separate header/footer.
 *
 * Back-compat: the returned promise still resolves with an
 * RpEditorResult on Apply or null on Close/Escape, matching the
 * pre-redesign API exactly.
 */
import { RpEditorConfig, RpEditorResult } from './types/index.js';
import { mergeConfig } from './utils/defaults.js';
import { RpImageEditor } from './editor.js';
import { getLocalePack } from './i18n/index.js';

export interface ModalOptions {
  image: File | Blob | string;
  config?: Partial<RpEditorConfig>;
  onApply?: (result: RpEditorResult) => void;
  onClose?: () => void;
}

export function openEditorModal(
  options: ModalOptions,
): Promise<RpEditorResult | null> {
  return new Promise((resolve) => {
    const merged = mergeConfig(options.config);
    const theme = merged.theme;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'rp-editor-modal-backdrop rp-ie-modal-backdrop';

    // Modal frame — a container the editor shell will fill entirely.
    const modal = document.createElement('div');
    modal.className = 'rp-editor-modal rp-ie-modal';
    modal.style.setProperty(
      '--rp-ie-modal-radius',
      theme.modalBorderRadius || '16px',
    );
    if (theme.modalMaxWidth) {
      modal.style.setProperty('--rp-ie-modal-max-width', theme.modalMaxWidth);
    }
    if (theme.modalHeight) {
      modal.style.setProperty('--rp-ie-modal-height', theme.modalHeight);
    }

    // Dialog semantics so assistive tech treats the editor as a modal.
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute(
      'aria-label',
      theme.headerTitle ||
        options.config?.labels?.headerTitle ||
        getLocalePack(options.config?.language).headerTitle,
    );
    modal.tabIndex = -1;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Return focus to whatever opened the editor once it closes.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Keep Tab / Shift+Tab inside the editor while it is open.
    const focusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!modal.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', focusTrap, true);

    let editor: RpImageEditor | null = null;
    let isClosing = false;
    let isApplying = false;

    const cleanup = () => {
      if (isClosing) return;
      isClosing = true;
      editor?.destroy();
      editor = null;
      document.removeEventListener('keydown', focusTrap, true);
      document.body.style.overflow = originalOverflow;
      backdrop.remove();
      if (previouslyFocused && previouslyFocused.isConnected) {
        try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    };

    const doClose = () => {
      cleanup();
      options.onClose?.();
      resolve(null);
    };

    const doApply = async () => {
      if (!editor || isApplying || isClosing) return;
      isApplying = true;
      try {
        const result = await editor.getResult();
        cleanup();
        options.onApply?.(result);
        resolve(result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[RpImageEditor] Export failed:', err);
        isApplying = false;
      }
    };

    // Instantiate editor with modal-scoped Apply/Close wiring. The
    // shell renders these buttons in the top bar and hides them when
    // the callbacks are absent.
    editor = new RpImageEditor(modal, {
      ...(options.config || {}),
      onApply: doApply,
      onClose: doClose,
    });

    // Start keyboard users inside the editor.
    modal.focus({ preventScroll: true });

    editor
      .loadImage(options.image)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[RpImageEditor] Failed to load image:', err);
        cleanup();
        resolve(null);
      });
  });
}
