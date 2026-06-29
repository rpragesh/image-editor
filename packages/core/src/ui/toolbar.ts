/**
 * Toolbar UI — grouped toolbar with flyout menus, tooltips, and disabledFeatures support
 */
import { ICONS } from './icons.js';
import { EditorMode, RpEditorTheme, CropAspectRatio } from '../types/index.js';

export interface ToolbarCallbacks {
  onModeChange: (mode: EditorMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onColorChange: (color: string) => void;
  onBrushWidthChange: (width: number) => void;
  onCropRatioChange: (ratio: number | null) => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onDeleteAnnotation?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Button / Group definition types                                   */
/* ------------------------------------------------------------------ */

interface ToolButton {
  /** Key used for disabledFeatures matching and data attribute */
  id: string;
  icon: string;
  title: string;
  mode?: EditorMode;
  action?: string;
}

interface ToolGroup {
  /** Key used for disabledFeatures matching at the group level */
  id: string;
  icon: string;
  title: string;
  children: ToolButton[];
}

type ToolItem = (ToolButton & { type: 'button' }) | (ToolGroup & { type: 'group' });

/* ------------------------------------------------------------------ */

/**
 * Expand group-level disabled names into their individual children.
 * e.g. 'zoom' -> ['zoomIn', 'zoomOut']
 */
const GROUP_EXPANSION: Record<string, string[]> = {
  zoom: ['zoomIn', 'zoomOut'],
  transform: ['rotateLeft', 'rotateRight'],
  annotate: ['draw', 'text', 'callout', 'eraser'],
  shapes: ['shape-circle', 'shape-ellipse', 'shape-square', 'shape-rectangle', 'shape-arrow'],
};

function expandDisabled(raw: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of raw) {
    const expanded = GROUP_EXPANSION[name];
    if (expanded) {
      expanded.forEach((n) => set.add(n));
      set.add(name); // also mark group id itself
    } else {
      set.add(name);
    }
  }
  return set;
}

/* ------------------------------------------------------------------ */

export class Toolbar {
  private container: HTMLElement;
  private theme: RpEditorTheme;
  private colorPalette: string[];
  private cropRatios: CropAspectRatio[];
  private callbacks: ToolbarCallbacks;
  private disabledSet: Set<string>;

  private activeMode: EditorMode = 'move';
  private toolbarEl: HTMLElement | null = null;
  private subPanelEl: HTMLElement | null = null;
  private openFlyout: HTMLElement | null = null;
  private canUndoState = false;
  private canRedoState = false;

  /** Outside-click handler reference (for cleanup) */
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    theme: RpEditorTheme,
    colorPalette: string[],
    cropRatios: CropAspectRatio[],
    callbacks: ToolbarCallbacks,
    disabledFeatures: string[] = []
  ) {
    this.container = container;
    this.theme = theme;
    this.colorPalette = colorPalette;
    this.cropRatios = cropRatios;
    this.callbacks = callbacks;
    this.disabledSet = expandDisabled(disabledFeatures);
  }

  /* ================================================================ */
  /*  Public API                                                      */
  /* ================================================================ */

  render(): void {
    // Sub-panel for contextual controls (colors, crop ratios, brush width)
    this.subPanelEl = document.createElement('div');
    this.subPanelEl.className = 'rp-editor-subpanel';
    this.subPanelEl.style.cssText = `
      display: none;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px;
      background: ${this.theme.toolbarBackground || '#2d2d2d'};
      flex-wrap: wrap;
      border-top: 1px solid rgba(255,255,255,0.1);
    `;

    // Main toolbar row
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'rp-editor-toolbar';
    this.toolbarEl.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 8px;
      background: ${this.theme.toolbarBackground || '#2d2d2d'};
      flex-wrap: wrap;
      position: relative;
    `;

    const items = this.buildItemList();
    items.forEach((item) => {
      if (item.type === 'button') {
        const el = this.createToolButton(item);
        this.toolbarEl!.appendChild(el);
      } else {
        const el = this.createGroupButton(item);
        if (el) this.toolbarEl!.appendChild(el);
      }
    });

    this.container.appendChild(this.subPanelEl);
    this.container.appendChild(this.toolbarEl);
    this.updateActiveButton();

    // Global click to close flyouts
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.openFlyout && !this.openFlyout.contains(e.target as Node)) {
        this.closeFlyout();
      }
    };
    document.addEventListener('mousedown', this.outsideClickHandler, true);
  }

  updateZoomState(zoomLevel: number): void {
    this.setItemOpacity('zoomOut', zoomLevel > 1);
    this.setItemOpacity('zoomIn', zoomLevel < 5);
  }

  updateHistoryState(canUndo: boolean, canRedo: boolean): void {
    this.canUndoState = canUndo;
    this.canRedoState = canRedo;
    this.setItemOpacity('undo', canUndo);
    this.setItemOpacity('redo', canRedo);
  }

  setActiveMode(mode: EditorMode): void {
    this.activeMode = mode;
    this.updateActiveButton();
    this.updateSubPanel();
  }

  destroy(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }
    this.toolbarEl?.remove();
    this.subPanelEl?.remove();
    this.toolbarEl = null;
    this.subPanelEl = null;
  }

  /* ================================================================ */
  /*  Item definitions                                                */
  /* ================================================================ */

  private buildItemList(): ToolItem[] {
    const all: ToolItem[] = [
      { type: 'button', id: 'move', icon: 'move', title: 'Move / Pan', mode: 'move' },
      { type: 'button', id: 'crop', icon: 'crop', title: 'Crop', mode: 'crop' },
      {
        type: 'group', id: 'zoom', icon: 'zoom', title: 'Zoom',
        children: [
          { id: 'zoomIn', icon: 'zoomIn', title: 'Zoom In', action: 'zoomIn' },
          { id: 'zoomOut', icon: 'zoomOut', title: 'Zoom Out', action: 'zoomOut' },
        ],
      },
      {
        type: 'group', id: 'transform', icon: 'transform', title: 'Transform',
        children: [
          { id: 'rotateLeft', icon: 'rotateLeft', title: 'Rotate Left', action: 'rotateLeft' },
          { id: 'rotateRight', icon: 'rotateRight', title: 'Rotate Right', action: 'rotateRight' },
        ],
      },
      {
        type: 'group', id: 'annotate', icon: 'annotate', title: 'Annotate',
        children: [
          { id: 'draw', icon: 'draw', title: 'Draw', mode: 'draw' },
          { id: 'text', icon: 'text', title: 'Add Text', mode: 'text' },
          { id: 'callout', icon: 'callout', title: 'Callout', mode: 'callout' },
          { id: 'eraser', icon: 'eraser', title: 'Eraser', mode: 'eraser' },
        ],
      },
      {
        type: 'group', id: 'shapes', icon: 'shapes', title: 'Shapes',
        children: [
          { id: 'shape-circle', icon: 'circle', title: 'Circle', mode: 'shape-circle' },
          { id: 'shape-ellipse', icon: 'ellipse', title: 'Ellipse', mode: 'shape-ellipse' },
          { id: 'shape-square', icon: 'square', title: 'Square', mode: 'shape-square' },
          { id: 'shape-rectangle', icon: 'rectangle', title: 'Rectangle', mode: 'shape-rectangle' },
          { id: 'shape-arrow', icon: 'arrow', title: 'Arrow', mode: 'shape-arrow' },
        ],
      },
      { type: 'button', id: 'undo', icon: 'undo', title: 'Undo', action: 'undo' },
      { type: 'button', id: 'redo', icon: 'redo', title: 'Redo', action: 'redo' },
      { type: 'button', id: 'reset', icon: 'reset', title: 'Reset', action: 'reset' },
    ];

    // Filter out disabled items
    return all.reduce<ToolItem[]>((acc, item) => {
      if (item.type === 'button') {
        if (!this.disabledSet.has(item.id)) acc.push(item);
      } else {
        // Filter children first
        const visibleChildren = item.children.filter((c) => !this.disabledSet.has(c.id));
        if (visibleChildren.length > 0) {
          // If the group id itself is disabled, skip entirely
          if (this.disabledSet.has(item.id)) return acc;
          // If only 1 child remains, promote it to a top-level button
          if (visibleChildren.length === 1) {
            const c = visibleChildren[0];
            acc.push({ type: 'button', ...c });
          } else {
            acc.push({ ...item, children: visibleChildren });
          }
        }
      }
      return acc;
    }, []);
  }

  /* ================================================================ */
  /*  Button creation                                                 */
  /* ================================================================ */

  private createToolButton(def: ToolButton & { type?: string }): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'rp-editor-tool-btn';
    btn.innerHTML = (ICONS as any)[def.icon] || '';

    if (def.mode) btn.dataset.mode = def.mode;
    if (def.action) btn.dataset.action = def.action;
    btn.dataset.toolId = def.id;

    this.applyBtnStyle(btn);
    this.applyTooltip(btn, def.title);

    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '22');
      svg.setAttribute('height', '22');
      // Bump stroke a touch — stroke-width: 2 on 22×22 looks pale on
      // dark backgrounds. 2.2 stays crisp on light themes too.
      if (svg.getAttribute('stroke') === 'currentColor') {
        svg.setAttribute('stroke-width', '2.2');
      }
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeFlyout();
      this.handleButtonClick(def.mode, def.action);
    });
    this.addHoverEffect(btn);
    return btn;
  }

  private createGroupButton(group: ToolGroup & { type: string }): HTMLElement | null {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-flex;';
    wrapper.dataset.groupId = group.id;

    // The visible trigger button
    const btn = document.createElement('button');
    btn.className = 'rp-editor-tool-btn rp-editor-group-btn';
    btn.dataset.groupId = group.id;

    // Icon + chevron
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = (ICONS as any)[group.icon] || '';
    iconSpan.querySelector('svg')?.setAttribute('width', '18');
    iconSpan.querySelector('svg')?.setAttribute('height', '18');
    iconSpan.style.cssText = 'display:flex;align-items:center;';

    const chevron = document.createElement('span');
    chevron.innerHTML = ICONS.chevronDown;
    chevron.querySelector('svg')?.setAttribute('width', '8');
    chevron.querySelector('svg')?.setAttribute('height', '8');
    chevron.style.cssText = 'display:flex;align-items:center;margin-left:2px;opacity:0.7;';

    btn.appendChild(iconSpan);
    btn.appendChild(chevron);

    this.applyBtnStyle(btn, true);
    this.applyTooltip(btn, group.title);
    this.addHoverEffect(btn);

    // Build flyout panel
    const flyout = this.buildFlyout(group.children);
    wrapper.appendChild(flyout);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.openFlyout === flyout) {
        this.closeFlyout();
      } else {
        this.closeFlyout();
        flyout.style.display = 'flex';
        this.openFlyout = flyout;
      }
    });

    wrapper.appendChild(btn);
    return wrapper;
  }

  private buildFlyout(children: ToolButton[]): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'rp-editor-flyout';
    panel.style.cssText = `
      display: none;
      flex-direction: row;
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: ${this.theme.toolbarBackground || '#2d2d2d'};
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 4px;
      gap: 2px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      white-space: nowrap;
    `;

    children.forEach((c) => {
      const childBtn = document.createElement('button');
      childBtn.className = 'rp-editor-tool-btn';
      childBtn.innerHTML = (ICONS as any)[c.icon] || '';
      if (c.mode) childBtn.dataset.mode = c.mode;
      if (c.action) childBtn.dataset.action = c.action;
      childBtn.dataset.toolId = c.id;

      this.applyBtnStyle(childBtn);
      this.applyTooltip(childBtn, c.title);

      childBtn.querySelector('svg')?.setAttribute('width', '22');
      childBtn.querySelector('svg')?.setAttribute('height', '22');
      const childSvg = childBtn.querySelector('svg');
      if (childSvg && childSvg.getAttribute('stroke') === 'currentColor') {
        childSvg.setAttribute('stroke-width', '2.2');
      }

      childBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Keep flyout open — only close on outside click
        this.handleButtonClick(c.mode, c.action);
      });
      this.addHoverEffect(childBtn);
      panel.appendChild(childBtn);
    });

    return panel;
  }

  /* ================================================================ */
  /*  Click / state handling                                          */
  /* ================================================================ */

  private handleButtonClick(mode?: EditorMode, action?: string): void {
    if (mode) {
      this.activeMode = mode;
      this.callbacks.onModeChange(mode);
      this.updateActiveButton();
      this.updateSubPanel();
    } else if (action) {
      switch (action) {
        case 'zoomIn': this.callbacks.onZoomIn(); break;
        case 'zoomOut': this.callbacks.onZoomOut(); break;
        case 'rotateLeft': this.callbacks.onRotateLeft(); break;
        case 'rotateRight': this.callbacks.onRotateRight(); break;
        case 'undo': this.callbacks.onUndo(); break;
        case 'redo': this.callbacks.onRedo(); break;
        case 'reset': this.callbacks.onReset(); break;
      }
    }
  }

  private updateActiveButton(): void {
    if (!this.toolbarEl) return;
    // Top-level and flyout buttons
    const buttons = this.toolbarEl.querySelectorAll('.rp-editor-tool-btn');
    buttons.forEach((btn) => {
      const el = btn as HTMLElement;
      const isActive = el.dataset.mode === this.activeMode;
      el.style.background = isActive
        ? (this.theme.toolbarActiveIconColor || '#4a90d9')
        : 'transparent';
      el.style.color = isActive
        ? '#ffffff'
        : (this.theme.toolbarIconColor || '#ffffff');
    });

    // Highlight group trigger when a child mode is active
    const groupBtns = this.toolbarEl.querySelectorAll('.rp-editor-group-btn');
    groupBtns.forEach((btn) => {
      const groupEl = btn as HTMLElement;
      const wrapper = groupEl.closest('[data-group-id]');
      if (!wrapper) return;
      const flyout = wrapper.querySelector('.rp-editor-flyout');
      if (!flyout) return;
      const hasActiveChild = flyout.querySelector(`[data-mode="${this.activeMode}"]`) != null;
      if (hasActiveChild) {
        groupEl.style.background = this.theme.toolbarActiveIconColor || '#4a90d9';
        groupEl.style.color = '#ffffff';
      }
    });
  }

  private closeFlyout(): void {
    if (this.openFlyout) {
      this.openFlyout.style.display = 'none';
      this.openFlyout = null;
    }
  }

  /* ================================================================ */
  /*  Sub-panel (colors, crop)                                        */
  /* ================================================================ */

  private updateSubPanel(): void {
    if (!this.subPanelEl) return;
    this.subPanelEl.innerHTML = '';
    this.subPanelEl.style.display = 'none';

    const isShapeMode =
      this.activeMode === 'shape-circle' ||
      this.activeMode === 'shape-ellipse' ||
      this.activeMode === 'shape-square' ||
      this.activeMode === 'shape-rectangle' ||
      this.activeMode === 'shape-arrow';

    if (this.activeMode === 'draw' || this.activeMode === 'text' || this.activeMode === 'callout' || isShapeMode) {
      this.showColorPicker();
      if (this.activeMode === 'callout' || isShapeMode) {
        this.showDeleteButton();
      }
    } else if (this.activeMode === 'crop') {
      this.showCropRatioSelector();
    }
  }

  private showColorPicker(): void {
    if (!this.subPanelEl) return;
    this.subPanelEl.style.display = 'flex';

    this.colorPalette.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.className = 'rp-color-swatch';
      swatch.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.3);
        background: ${color};
        cursor: pointer;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.15s, border-color 0.15s;
      `;

      swatch.addEventListener('click', (e) => {
        e.preventDefault();
        this.callbacks.onColorChange(color);
        this.subPanelEl!.querySelectorAll('.rp-color-swatch').forEach((s) => {
          (s as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
          (s as HTMLElement).style.transform = 'scale(1)';
        });
        swatch.style.borderColor = '#ffffff';
        swatch.style.transform = 'scale(1.2)';
      });

      this.subPanelEl!.appendChild(swatch);
    });

    // Brush width slider (also shown for shape modes so the user can
    // adjust shape stroke thickness)
    const isShapeMode =
      this.activeMode === 'shape-circle' ||
      this.activeMode === 'shape-ellipse' ||
      this.activeMode === 'shape-square' ||
      this.activeMode === 'shape-rectangle' ||
      this.activeMode === 'shape-arrow';
    if (this.activeMode === 'draw' || isShapeMode) {
      const separator = document.createElement('div');
      separator.style.cssText = 'width: 1px; height: 24px; background: rgba(255,255,255,0.2); margin: 0 8px;';
      this.subPanelEl.appendChild(separator);

      const label = document.createElement('span');
      label.textContent = 'Size:';
      label.style.cssText = `color: ${this.theme.toolbarIconColor || '#ffffff'}; font-size: 12px; font-weight: 600; letter-spacing: 0.2px;`;
      this.subPanelEl.appendChild(label);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '1';
      slider.max = '20';
      slider.value = '3';
      slider.style.cssText = 'width: 80px; cursor: pointer;';
      slider.addEventListener('input', () => {
        this.callbacks.onBrushWidthChange(parseInt(slider.value, 10));
      });
      this.subPanelEl.appendChild(slider);
    }
  }

  /** Show a delete (trash) button in the sub-panel — used for callout mode */
  private showDeleteButton(): void {
    if (!this.subPanelEl) return;

    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 24px; background: rgba(255,255,255,0.2); margin: 0 8px;';
    this.subPanelEl.appendChild(separator);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'rp-delete-annotation-btn';
    deleteBtn.innerHTML = (ICONS as any).delete || '';
    deleteBtn.setAttribute('title', 'Delete selected');
    deleteBtn.querySelector('svg')?.setAttribute('width', '20');
    deleteBtn.querySelector('svg')?.setAttribute('height', '20');
    deleteBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255,255,255,0.3);
      background: rgba(239,68,68,0.15);
      color: #ef4444;
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    `;
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'rgba(239,68,68,0.35)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = 'rgba(239,68,68,0.15)';
    });
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onDeleteAnnotation?.();
    });
    this.subPanelEl.appendChild(deleteBtn);
  }

  private showCropRatioSelector(): void {
    if (!this.subPanelEl) return;
    this.subPanelEl.style.display = 'flex';

    const iconColor = this.theme.toolbarIconColor || '#ffffff';
    const activeColor = this.theme.toolbarActiveIconColor || '#4a90d9';
    // Bump border + idle background opacity so chips stay visible on
    // dark themes where a 0.3-alpha white border is nearly invisible.
    const idleBorder = 'rgba(255,255,255,0.55)';
    const idleBg = 'rgba(255,255,255,0.08)';

    this.cropRatios.forEach((ratio, idx) => {
      const btn = document.createElement('button');
      btn.textContent = ratio.label;
      const isActive = idx === 0;
      btn.style.cssText = `
        padding: 6px 12px;
        border: 1px solid ${isActive ? activeColor : idleBorder};
        background: ${isActive ? activeColor : idleBg};
        color: ${isActive ? '#ffffff' : iconColor};
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.2px;
        -webkit-tap-highlight-color: transparent;
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.callbacks.onCropRatioChange(ratio.value);
        this.subPanelEl!.querySelectorAll('button').forEach((b) => {
          if (!b.classList.contains('rp-crop-action-btn')) {
            const el = b as HTMLElement;
            el.style.background = idleBg;
            el.style.borderColor = idleBorder;
            el.style.color = iconColor;
          }
        });
        btn.style.background = activeColor;
        btn.style.borderColor = activeColor;
        btn.style.color = '#ffffff';
      });

      this.subPanelEl!.appendChild(btn);
    });

    // Apply Crop button
    const applyCropBtn = document.createElement('button');
    applyCropBtn.textContent = '✓ Apply Crop';
    applyCropBtn.className = 'rp-crop-action-btn';
    applyCropBtn.style.cssText = `
      padding: 6px 14px;
      border: none;
      background: ${this.theme.applyButtonBackground || '#4a90d9'};
      color: ${this.theme.applyButtonTextColor || '#ffffff'};
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-left: 12px;
    `;
    applyCropBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.callbacks.onApplyCrop();
    });
    this.subPanelEl!.appendChild(applyCropBtn);

    // Cancel Crop button
    const cancelCropBtn = document.createElement('button');
    cancelCropBtn.textContent = '✕ Cancel';
    cancelCropBtn.className = 'rp-crop-action-btn';
    cancelCropBtn.style.cssText = `
      padding: 6px 14px;
      border: 1px solid ${idleBorder};
      background: ${idleBg};
      color: ${iconColor};
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    `;
    cancelCropBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.callbacks.onCancelCrop();
    });
    this.subPanelEl!.appendChild(cancelCropBtn);
  }

  /* ================================================================ */
  /*  Helpers                                                         */
  /* ================================================================ */

  private applyBtnStyle(btn: HTMLElement, isGroup = false): void {
    btn.style.cssText = `
      min-width: ${isGroup ? '48px' : '40px'};
      height: 40px;
      padding: ${isGroup ? '8px 6px' : '8px'};
      border: none;
      background: transparent;
      color: ${this.theme.toolbarIconColor || '#ffffff'};
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
      -webkit-tap-highlight-color: transparent;
      position: relative;
    `;
  }

  private applyTooltip(el: HTMLElement, text: string): void {
    el.setAttribute('title', text);
  }

  private addHoverEffect(btn: HTMLElement): void {
    btn.addEventListener('mouseenter', () => {
      const mode = btn.dataset.mode;
      if (!(mode && this.activeMode === mode)) {
        btn.style.background = 'rgba(255,255,255,0.1)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      const mode = btn.dataset.mode;
      if (!(mode && this.activeMode === mode)) {
        // Re-check group highlight
        const isGroupHighlighted = btn.classList.contains('rp-editor-group-btn') &&
          this.isGroupActive(btn);
        btn.style.background = isGroupHighlighted
          ? (this.theme.toolbarActiveIconColor || '#4a90d9')
          : 'transparent';
      }
    });
  }

  private isGroupActive(groupBtn: HTMLElement): boolean {
    const wrapper = groupBtn.closest('[data-group-id]');
    if (!wrapper) return false;
    const flyout = wrapper.querySelector('.rp-editor-flyout');
    if (!flyout) return false;
    return flyout.querySelector(`[data-mode="${this.activeMode}"]`) != null;
  }

  /** Enable / disable visual state of a tool button by id */
  private setItemOpacity(toolId: string, enabled: boolean): void {
    // Search both top-level and flyout buttons
    const el = this.toolbarEl?.querySelector(`[data-tool-id="${toolId}"]`) as HTMLElement | null;
    if (el) {
      el.style.opacity = enabled ? '1' : '0.3';
      el.style.pointerEvents = enabled ? 'auto' : 'none';
    }
  }
}
