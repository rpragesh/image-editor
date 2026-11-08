/**
 * Modal helpers — a backdrop + container that mounts the editor shell
 * full-screen. The shell owns the entire chrome (top bar, tool rail,
 * settings panel) including Apply and Close.
 *
 * - `openEditorModal` edits one image and resolves with an
 *   RpEditorResult on Apply or null on Close/Escape (unchanged API).
 * - `openMultiEditorModal` edits several images with a thumbnail strip
 *   and resolves with one result per image on Apply.
 */
import { RpEditorConfig, RpEditorResult } from './types/index.js';
import { mergeConfig } from './utils/defaults.js';
import { RpImageEditor } from './editor.js';
import { getLocalePack } from './i18n/index.js';
import type { LocalePack } from './i18n/index.js';
import { ICONS } from './ui/icons.js';

export interface ModalOptions {
  image: File | Blob | string;
  config?: Partial<RpEditorConfig>;
  onApply?: (result: RpEditorResult) => void;
  onClose?: () => void;
}

/** Image source accepted by the modals. */
export type RpImageSource = File | Blob | string;

export interface MultiModalOptions {
  /** The images to edit, in strip order. */
  images: RpImageSource[];
  /** Editor config shared by every image. `currentImageIndex` and `totalImages` are set for you. */
  config?: Partial<RpEditorConfig>;
  /** 0-based index of the image to open first. Default 0. */
  startIndex?: number;
  onApply?: (results: RpMultiEditorItemResult[]) => void;
  onClose?: () => void;
}

/** One entry of `openMultiEditorModal`'s result. */
export interface RpMultiEditorItemResult {
  /** 0-based position in `options.images`. */
  index: number;
  /** True if the user changed this image (an edit that wasn't undone). */
  edited: boolean;
  /** The exported image. Unedited images are exported too, in the configured format. */
  result: RpEditorResult;
}

type MultiStrings = Required<LocalePack>['multi'];

const MULTI_EN: MultiStrings = {
  images: 'Images',
  image: 'Image {index} of {total}',
  edited: 'edited',
  previous: 'Previous image',
  next: 'Next image',
  discardTitleOne: 'Discard changes to 1 image?',
  discardTitleOther: 'Discard changes to {count} images?',
  discardBody: "Your edits will be lost. This can't be undone.",
  discard: 'Discard',
  keepEditing: 'Keep editing',
  saving: 'Saving image {index} of {total}…',
  loadFailed: "This image couldn't be opened.",
};

function fill(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
}

/* ------------------------------------------------------------------ */
/*  Shared modal frame                                                */
/* ------------------------------------------------------------------ */

interface ModalFrame {
  modal: HTMLElement;
  cleanup: () => void;
  isClosed: () => boolean;
}

function createModalFrame(config: Partial<RpEditorConfig> | undefined): ModalFrame {
  const theme = mergeConfig(config).theme;

  const backdrop = document.createElement('div');
  backdrop.className = 'rp-editor-modal-backdrop rp-ie-modal-backdrop';

  // A container the editor shell fills entirely.
  const modal = document.createElement('div');
  modal.className = 'rp-editor-modal rp-ie-modal';
  modal.style.setProperty('--rp-ie-modal-radius', theme.modalBorderRadius || '16px');
  if (theme.modalMaxWidth) modal.style.setProperty('--rp-ie-modal-max-width', theme.modalMaxWidth);
  if (theme.modalHeight) modal.style.setProperty('--rp-ie-modal-height', theme.modalHeight);

  // Dialog semantics so assistive tech treats the editor as a modal.
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute(
    'aria-label',
    theme.headerTitle || config?.labels?.headerTitle || getLocalePack(config?.language).headerTitle,
  );
  modal.tabIndex = -1;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Return focus to whatever opened the editor once it closes.
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // Keep Tab / Shift+Tab inside the editor (or inside an open prompt).
  const focusTrap = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const scope = modal.querySelector<HTMLElement>('.rp-ie-confirm') ?? modal;
    const focusables = Array.from(
      scope.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (el) => (el.offsetParent !== null || el === document.activeElement) && !el.closest('[inert]'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!scope.contains(active)) {
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

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', focusTrap, true);
    document.body.style.overflow = originalOverflow;
    backdrop.remove();
    if (previouslyFocused && previouslyFocused.isConnected) {
      try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  };

  // Start keyboard users inside the editor.
  modal.focus({ preventScroll: true });

  return { modal, cleanup, isClosed: () => closed };
}

/* ------------------------------------------------------------------ */
/*  Single image                                                      */
/* ------------------------------------------------------------------ */

export function openEditorModal(
  options: ModalOptions,
): Promise<RpEditorResult | null> {
  return new Promise((resolve) => {
    const frame = createModalFrame(options.config);
    let editor: RpImageEditor | null = null;
    let isApplying = false;

    const cleanup = () => {
      editor?.destroy();
      editor = null;
      frame.cleanup();
    };

    const doClose = () => {
      if (frame.isClosed()) return;
      cleanup();
      options.onClose?.();
      resolve(null);
    };

    const doApply = async () => {
      if (!editor || isApplying || frame.isClosed()) return;
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

    // The shell renders Apply/Close in the top bar when these callbacks exist.
    editor = new RpImageEditor(frame.modal, {
      ...(options.config || {}),
      onApply: doApply,
      onClose: doClose,
    });

    editor.loadImage(options.image).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[RpImageEditor] Failed to load image:', err);
      if (frame.isClosed()) return;
      cleanup();
      resolve(null);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Several images                                                    */
/* ------------------------------------------------------------------ */

interface Slot {
  source: RpImageSource;
  pane: HTMLElement | null;
  editor: RpImageEditor | null;
  loading: Promise<boolean> | null;
  edited: boolean;
  failed: boolean;
  thumbUrl: string | null;
  revokeThumb: boolean;
  button: HTMLButtonElement | null;
}

/**
 * Edit several images in one modal. A thumbnail strip under the photo
 * switches images; each image keeps its own edits and undo history and
 * is only loaded when first opened.
 *
 * Resolves on Apply with one entry per image (unedited images are
 * exported too, with `edited: false`), or `null` on Close. Closing with
 * edits asks for confirmation first. Images that fail to load are left
 * out of the result.
 */
export function openMultiEditorModal(
  options: MultiModalOptions,
): Promise<RpMultiEditorItemResult[] | null> {
  const images = options.images ?? [];
  if (images.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const config = options.config ?? {};
    const total = images.length;
    const pack = getLocalePack(config.language);
    const t: MultiStrings = {
      ...MULTI_EN,
      ...(pack.multi ?? {}),
      ...((config.labels as any)?.multi ?? {}),
    };

    const frame = createModalFrame(config);
    const panes = document.createElement('div');
    panes.className = 'rp-ie-multi';
    frame.modal.appendChild(panes);

    const slots: Slot[] = images.map((source) => {
      let thumbUrl: string | null = null;
      let revokeThumb = false;
      if (typeof source === 'string') {
        thumbUrl = source;
      } else if (typeof URL !== 'undefined' && URL.createObjectURL) {
        thumbUrl = URL.createObjectURL(source);
        revokeThumb = true;
      }
      return { source, pane: null, editor: null, loading: null, edited: false, failed: false, thumbUrl, revokeThumb, button: null };
    });

    let current = -1;
    let pending = -1; // image being loaded to switch to
    let busy = false;
    let confirmEl: HTMLElement | null = null;

    /* ---- strip ---- */
    const strip = document.createElement('nav');
    strip.className = 'rp-ie-strip';
    strip.setAttribute('aria-label', t.images);

    const makeNav = (dir: -1 | 1) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rp-ie-strip__nav';
      b.setAttribute('aria-label', dir < 0 ? t.previous : t.next);
      b.title = dir < 0 ? t.previous : t.next;
      b.innerHTML = `<span class="rp-ie-icon" aria-hidden="true">${dir < 0 ? ICONS.chevronLeft : ICONS.chevronRight}</span>`;
      b.addEventListener('click', () => step(dir));
      return b;
    };
    const prevBtn = makeNav(-1);
    const nextBtn = makeNav(1);

    const list = document.createElement('div');
    list.className = 'rp-ie-strip__list';
    slots.forEach((slot, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rp-ie-thumb';
      b.dataset.index = String(i);
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.draggable = false;
      const num = document.createElement('span');
      num.className = 'rp-ie-thumb__num';
      num.textContent = String(i + 1);
      num.setAttribute('aria-hidden', 'true');
      if (slot.thumbUrl) {
        // HEIC and other formats the browser can't show fall back to the number.
        img.addEventListener('error', () => img.remove());
        img.src = slot.thumbUrl;
        b.appendChild(num);
        b.appendChild(img);
      } else {
        b.appendChild(num);
      }
      const dot = document.createElement('span');
      dot.className = 'rp-ie-thumb__dot';
      dot.setAttribute('aria-hidden', 'true');
      b.appendChild(dot);
      const warn = document.createElement('span');
      warn.className = 'rp-ie-thumb__warn rp-ie-icon';
      warn.setAttribute('aria-hidden', 'true');
      warn.innerHTML = ICONS.alert;
      b.appendChild(warn);
      b.addEventListener('click', () => show(i, true));
      slot.button = b;
      list.appendChild(b);
    });
    strip.append(prevBtn, list, nextBtn);

    const updateStrip = () => {
      slots.forEach((slot, i) => {
        const b = slot.button!;
        const parts = [fill(t.image, { index: i + 1, total })];
        if (slot.edited) parts.push(t.edited);
        if (slot.failed) parts.push(t.loadFailed);
        b.setAttribute('aria-label', parts.join(', '));
        b.title = parts.join(' · ');
        if (i === current) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
        b.classList.toggle('rp-ie-thumb--edited', slot.edited);
        b.classList.toggle('rp-ie-thumb--failed', slot.failed);
        b.classList.toggle('rp-ie-thumb--loading', i === pending);
      });
      prevBtn.disabled = current <= 0;
      nextBtn.disabled = current >= total - 1;
    };

    /* ---- editors ---- */
    const editedCount = () => slots.filter((s) => s.edited).length;

    const createEditor = (i: number): Promise<boolean> => {
      const slot = slots[i];
      if (slot.loading) return slot.loading;
      const pane = document.createElement('div');
      pane.className = 'rp-ie-multi__pane rp-ie-multi__pane--hidden';
      pane.setAttribute('inert', '');
      pane.setAttribute('aria-hidden', 'true');
      panes.appendChild(pane);
      slot.pane = pane;
      const editor = new RpImageEditor(pane, {
        ...config,
        currentImageIndex: i + 1,
        totalImages: total,
        onApply: () => { void doApply(); },
        onClose: requestClose,
      });
      slot.editor = editor;
      editor.on('history:changed', (s) => {
        slot.edited = s.canUndo;
        updateStrip();
      });
      slot.loading = editor.loadImage(slot.source).then(
        () => true,
        (err) => {
          // eslint-disable-next-line no-console
          console.error(`[RpImageEditor] Failed to load image ${i + 1}:`, err);
          slot.failed = true;
          editor.destroy();
          pane.remove();
          slot.editor = null;
          slot.pane = null;
          return false;
        },
      );
      return slot.loading;
    };

    const reveal = (i: number, focusThumb: boolean) => {
      const prev = slots[current];
      if (prev?.pane && current !== i) {
        prev.pane.classList.add('rp-ie-multi__pane--hidden');
        prev.pane.setAttribute('inert', '');
        prev.pane.setAttribute('aria-hidden', 'true');
      }
      const slot = slots[i];
      slot.pane!.classList.remove('rp-ie-multi__pane--hidden');
      slot.pane!.removeAttribute('inert');
      slot.pane!.removeAttribute('aria-hidden');
      current = i;
      slot.editor!.claimKeyboardShortcuts();
      // Moving a focused element drops its focus, so put it back after.
      slot.editor!.setStageFooter(total > 1 ? strip : null);
      updateStrip();
      slot.button!.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      if (focusThumb) slot.button!.focus({ preventScroll: true });
      else frame.modal.focus({ preventScroll: true });
    };

    const show = async (i: number, focusThumb = false) => {
      if (frame.isClosed() || busy || i < 0 || i >= total) return;
      if (i === current) {
        if (focusThumb) slots[i].button?.focus({ preventScroll: true });
        return;
      }
      pending = i;
      updateStrip();
      // Keep the current image on screen until the next one is ready.
      const ok = await createEditor(i);
      if (frame.isClosed() || pending !== i) return;
      pending = -1;
      if (ok) reveal(i, focusThumb);
      else if (current === -1) {
        // The first image failed: try the next one that loads.
        updateStrip();
        const next = slots.findIndex((s) => !s.failed);
        if (next === -1) { finish(null); return; }
        void show(next, focusThumb);
      } else {
        updateStrip();
        if (focusThumb) slots[i].button?.focus({ preventScroll: true });
      }
    };

    const step = (dir: -1 | 1) => {
      let i = current + dir;
      while (i >= 0 && i < total && slots[i].failed) i += dir;
      if (i >= 0 && i < total) void show(i, true);
    };

    /* ---- close / apply ---- */
    const finish = (value: RpMultiEditorItemResult[] | null) => {
      if (frame.isClosed()) return;
      for (const slot of slots) {
        slot.editor?.destroy();
        slot.editor = null;
        if (slot.revokeThumb && slot.thumbUrl) URL.revokeObjectURL(slot.thumbUrl);
      }
      frame.cleanup();
      if (value) options.onApply?.(value);
      else options.onClose?.();
      resolve(value);
    };

    const dismissConfirm = () => {
      if (!confirmEl) return;
      confirmEl.remove();
      confirmEl = null;
      slots[current]?.button?.focus({ preventScroll: true });
    };

    function requestClose() {
      if (frame.isClosed() || busy) return;
      if (confirmEl) { dismissConfirm(); return; } // Escape while prompting = keep editing
      const count = editedCount();
      if (count === 0) { finish(null); return; }
      const root = slots[current]?.editor?.getShellElement();
      if (!root) { finish(null); return; }

      const layer = document.createElement('div');
      layer.className = 'rp-ie-confirm';
      const box = document.createElement('div');
      box.className = 'rp-ie-confirm__box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'rp-ie-confirm-title');
      box.setAttribute('aria-describedby', 'rp-ie-confirm-body');
      const title = document.createElement('h2');
      title.id = 'rp-ie-confirm-title';
      title.className = 'rp-ie-confirm__title';
      title.textContent = count === 1 ? t.discardTitleOne : fill(t.discardTitleOther, { count });
      const body = document.createElement('p');
      body.id = 'rp-ie-confirm-body';
      body.className = 'rp-ie-confirm__body';
      body.textContent = t.discardBody;
      const actions = document.createElement('div');
      actions.className = 'rp-ie-confirm__actions';
      const keep = document.createElement('button');
      keep.type = 'button';
      keep.className = 'rp-ie-btn rp-ie-btn--ghost';
      keep.textContent = t.keepEditing;
      keep.addEventListener('click', dismissConfirm);
      const discard = document.createElement('button');
      discard.type = 'button';
      discard.className = 'rp-ie-btn rp-ie-btn--danger';
      discard.textContent = t.discard;
      discard.addEventListener('click', () => finish(null));
      actions.append(keep, discard);
      box.append(title, body, actions);
      layer.appendChild(box);
      layer.addEventListener('mousedown', (e) => { if (e.target === layer) dismissConfirm(); });
      root.appendChild(layer);
      confirmEl = layer;
      keep.focus();
    }

    const exportUnopened = async (slot: Slot): Promise<RpEditorResult | null> => {
      // Render off-screen at a normal size so the export matches an opened image.
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.setAttribute('inert', '');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1024px;height:768px;visibility:hidden;pointer-events:none;';
      document.body.appendChild(host);
      const editor = new RpImageEditor(host, { ...config, keyboardShortcutsScope: 'editor' });
      try {
        await editor.loadImage(slot.source);
        return await editor.getResult();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[RpImageEditor] Failed to export an unopened image:', err);
        slot.failed = true;
        return null;
      } finally {
        editor.destroy();
        host.remove();
      }
    };

    const doApply = async () => {
      if (frame.isClosed() || busy || confirmEl) return;
      busy = true;
      const root = slots[current]?.editor?.getShellElement();
      const status = document.createElement('div');
      status.className = 'rp-ie-busy';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      root?.appendChild(status);
      frame.modal.setAttribute('aria-busy', 'true');
      const results: RpMultiEditorItemResult[] = [];
      try {
        for (let i = 0; i < total; i++) {
          const slot = slots[i];
          if (slot.failed) continue;
          status.textContent = fill(t.saving, { index: i + 1, total });
          if (slot.loading) await slot.loading;
          if (slot.failed) continue;
          const result = slot.editor ? await slot.editor.getResult() : await exportUnopened(slot);
          if (result) results.push({ index: i, edited: slot.editor ? slot.edited : false, result });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[RpImageEditor] Export failed:', err);
        busy = false;
        status.remove();
        frame.modal.removeAttribute('aria-busy');
        updateStrip();
        slots[current]?.button?.focus({ preventScroll: true });
        return;
      }
      busy = false;
      finish(results);
    };

    const start = Math.min(Math.max(0, Math.floor(options.startIndex ?? 0)), total - 1);
    updateStrip();
    void show(start);
  });
}
