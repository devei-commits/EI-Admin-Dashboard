export interface SuggestPanelRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const VIEWPORT_PAD = 8;
const PANEL_GAP = 4;
const DEFAULT_MAX_HEIGHT = 240;
const MIN_PANEL_HEIGHT = 96;
const MIN_WIDTH = 220;

/** Collect scrollable ancestors so fixed dropdowns track modal / nested scroll. */
export function getScrollParents(el: HTMLElement | null): HTMLElement[] {
  const parents: HTMLElement[] = [];
  let node = el?.parentElement ?? null;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay' ||
      overflowX === 'auto' ||
      overflowX === 'scroll' ||
      overflowX === 'overlay'
    ) {
      parents.push(node);
    }
    node = node.parentElement;
  }
  return parents;
}

/** Position a fixed suggestion panel within the viewport, flipping above when needed. */
export function computeSuggestPanelRect(anchor: HTMLElement): SuggestPanelRect {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = Math.min(Math.max(r.width, MIN_WIDTH), vw - VIEWPORT_PAD * 2);
  let left = r.left;
  if (left + width > vw - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width);
  }
  left = Math.max(VIEWPORT_PAD, left);

  const spaceBelow = vh - VIEWPORT_PAD - (r.bottom + PANEL_GAP);
  const spaceAbove = r.top - VIEWPORT_PAD - PANEL_GAP;
  const openBelow = spaceBelow >= MIN_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  if (openBelow) {
    return {
      top: r.bottom + PANEL_GAP,
      left,
      width,
      maxHeight: Math.min(DEFAULT_MAX_HEIGHT, Math.max(MIN_PANEL_HEIGHT, spaceBelow)),
    };
  }

  const maxHeight = Math.min(DEFAULT_MAX_HEIGHT, Math.max(MIN_PANEL_HEIGHT, spaceAbove));
  let top = r.top - PANEL_GAP - maxHeight;
  if (top < VIEWPORT_PAD) {
    top = VIEWPORT_PAD;
  }

  return {
    top,
    left,
    width,
    maxHeight: Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, r.top - VIEWPORT_PAD - PANEL_GAP)),
  };
}
