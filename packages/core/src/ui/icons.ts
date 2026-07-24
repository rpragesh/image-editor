/**
 * Icon set — single-weight 1.5px stroke, 20×20 viewBox, currentColor.
 * All icons are inline SVG strings so the bundle stays dependency-free.
 * Consumers can override sizes via CSS (SVGs inherit width/height from
 * their parent `.rp-ie-icon` wrapper).
 */

const S = (body: string): string =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const F = (body: string): string =>
  `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS: Record<string, string> = {
  // Brand mark (used in top bar next to the title)
  logo: S(
    '<rect x="2.5" y="2.5" width="15" height="15" rx="3.5"/><path d="M6 13l2.5-3 2.5 3 3.5-4.5"/><circle cx="7.5" cy="7" r="1"/>',
  ),

  // Left rail tools
  select: S('<path d="M4 3l12 5-5 2-2 5-5-12z"/>'),
  move: S(
    '<path d="M10 3v14M3 10h14"/><path d="M7 6l3-3 3 3M14 7l3 3-3 3M7 14l3 3 3-3M6 7l-3 3 3 3"/>',
  ),
  crop: S(
    '<path d="M6 2v12a1 1 0 001 1h11"/><path d="M2 6h12a1 1 0 011 1v11"/>',
  ),
  draw: S(
    '<path d="M14.5 3.5l2 2-9.5 9.5L4 16l1-3 9.5-9.5z"/><path d="M13 5l2 2"/>',
  ),
  eraser: S(
    '<path d="M15.5 4.5l-11 11a2 2 0 000 2.8h4.4l8-8-1.4-1.4"/><path d="M9.5 10.5l4 4"/><path d="M6 18h12"/>',
  ),
  text: S(
    '<path d="M4 5V4h12v1"/><path d="M10 4v13"/><path d="M8 17h4"/>',
  ),
  shapes: S(
    '<circle cx="6.5" cy="7" r="3.5"/><rect x="9" y="9" width="8" height="8" rx="1"/>',
  ),
  stickers: S(
    '<path d="M12 2.5a7.5 7.5 0 105.5 12.5L12 17V2.5z" transform="translate(0.5 0)"/><circle cx="7.5" cy="8" r="1"/><circle cx="11.5" cy="8" r="1"/><path d="M7 11.5c1 1 3 1 4 0"/>',
  ),
  filters: S(
    '<circle cx="7" cy="10" r="5"/><circle cx="13" cy="10" r="5"/><path d="M10 5.5a5 5 0 010 9"/>',
  ),
  adjust: S(
    '<path d="M4 5h9"/><circle cx="15" cy="5" r="1.5"/><path d="M4 10h5"/><circle cx="11" cy="10" r="1.5"/><path d="M4 15h9"/><circle cx="15" cy="15" r="1.5"/>',
  ),

  // Right quick-rail (contextual, Draw shown)
  pen: S(
    '<path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/><path d="M12 5l3 3"/>',
  ),

  // Top-bar / actions
  undo: S(
    '<path d="M4 8h9a4 4 0 010 8h-3"/><path d="M7 5L4 8l3 3"/>',
  ),
  redo: S(
    '<path d="M16 8H7a4 4 0 000 8h3"/><path d="M13 5l3 3-3 3"/>',
  ),
  zoomIn: S(
    '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/><path d="M9 6.5v5M6.5 9h5"/>',
  ),
  zoomOut: S(
    '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/><path d="M6.5 9h5"/>',
  ),
  zoom: S('<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>'),
  fit: S(
    '<path d="M3 7V3h4"/><path d="M17 7V3h-4"/><path d="M3 13v4h4"/><path d="M17 13v4h-4"/>',
  ),
  fullscreen: S(
    '<path d="M3 8V3h5"/><path d="M17 8V3h-5"/><path d="M3 12v5h5"/><path d="M17 12v5h-5"/>',
  ),
  fullscreenExit: S(
    '<path d="M8 3v5H3"/><path d="M12 3v5h5"/><path d="M8 17v-5H3"/><path d="M12 17v-5h5"/>',
  ),
  hundred: S(
    '<path d="M4 6l2-2v12"/><circle cx="12" cy="10" r="4"/>',
  ),
  apply: S('<path d="M4 10.5l4 4 8-9"/>'),
  close: S('<path d="M5 5l10 10M15 5L5 15"/>'),
  chevronDown: S('<path d="M5 8l5 5 5-5"/>'),
  chevronUp: S('<path d="M5 12l5-5 5 5"/>'),

  // Transforms
  rotateLeft: S(
    '<path d="M3 5v4h4"/><path d="M3 9a7 7 0 117 7"/>',
  ),
  rotateRight: S(
    '<path d="M17 5v4h-4"/><path d="M17 9a7 7 0 10-7 7"/>',
  ),
  flipH: S(
    '<path d="M10 3v14"/><path d="M5 6l-2 4 2 4z"/><path d="M15 6l2 4-2 4z"/>',
  ),
  flipV: S(
    '<path d="M3 10h14"/><path d="M6 5l4-2 4 2z"/><path d="M6 15l4 2 4-2z"/>',
  ),
  reset: S(
    '<path d="M3 4v4h4"/><path d="M3 8a7 7 0 116.5 9.5"/>',
  ),

  // Shapes sub-picker
  circle: S('<circle cx="10" cy="10" r="6.5"/>'),
  ellipse: S('<ellipse cx="10" cy="10" rx="7" ry="4.5"/>'),
  square: S('<rect x="4" y="4" width="12" height="12" rx="1"/>'),
  rectangle: S('<rect x="3" y="6" width="14" height="8" rx="1"/>'),
  arrow: S('<path d="M4 16L16 4"/><path d="M9 4h7v7"/>'),
  polyline: S(
    '<path d="M3 16l4-7 4 5 6-9"/><circle cx="3" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="7" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="11" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="5" r="1.3" fill="currentColor" stroke="none"/>',
  ),
  callout: S(
    '<path d="M17 12a2 2 0 01-2 2H8l-3 3v-3H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2z"/>',
  ),

  // Misc
  delete: S(
    '<path d="M4 6h12"/><path d="M8 6V4h4v2"/><path d="M5 6l1 10a1 1 0 001 1h6a1 1 0 001-1l1-10"/><path d="M8.5 9v6M11.5 9v6"/>',
  ),
  plus: S('<path d="M10 4v12M4 10h12"/>'),
  lock: S(
    '<rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6a3 3 0 016 0v3"/>',
  ),
  wand: S(
    '<path d="M13 3l1.5 1.5"/><path d="M15 5l2 2"/><path d="M4 17L14 7"/><path d="M13 7l-2-2"/><path d="M15 9l2-2"/>',
  ),
  info: S('<circle cx="10" cy="10" r="7"/><path d="M10 9v4"/><circle cx="10" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>'),
  colors: S(
    '<circle cx="10" cy="10" r="7"/><circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="13.5" cy="11.5" r="1.2" fill="currentColor" stroke="none"/>',
  ),

  // Empty-state illustration for the canvas stage
  imagePlaceholder: S(
    '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><circle cx="7" cy="8" r="1.3"/><path d="M3 14l4-4 3 3 3-3 4 5"/>',
  ),

  spinner: F(
    '<path d="M10 2a8 8 0 018 8h-2a6 6 0 00-6-6V2z"/>',
  ),
};
