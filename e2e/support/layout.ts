/// <reference lib="dom" />
// The measuring code runs inside the page, so it needs the browser types.
import type { Page } from '@playwright/test';

/** The three sizes every screen is checked at (same as `pnpm ui:screenshots`). */
export const LAYOUT_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 },
} as const;

/**
 * On a tablet or a desktop, the screen's content has to fill at least this share
 * of the room it has (the window minus the sidebar). Below it, the screen is a
 * phone column floating in an empty desktop.
 */
export const MIN_WIDTH_SHARE = 0.7;

export interface LayoutReport {
  /** Width of the page beyond the window (horizontal scroll), in px. */
  horizontalOverflow: number;
  /** Visible elements that stick out past the right edge without a scroll container. */
  offscreen: string[];
  /** Content width / room it has, for the screen's `main`. */
  widthShare: number;
}

/** Measures the rendered screen. Runs in the browser, so it can't use anything from outside. */
export function measureLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const describe = (element: Element) => {
      const label =
        element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '';
      return `<${element.tagName.toLowerCase()}> "${label}"`;
    };
    const clippedByAncestor = (element: Element) => {
      for (let node = element.parentElement; node && node !== document.body;) {
        if (getComputedStyle(node).overflowX !== 'visible') return true;
        node = node.parentElement;
      }
      return false;
    };

    const offscreen: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= viewport + 1) continue;
      if (getComputedStyle(element).visibility === 'hidden') continue;
      if (getComputedStyle(element).position === 'fixed' && box.left >= viewport) continue;
      if (clippedByAncestor(element)) continue;
      offscreen.push(describe(element));
      if (offscreen.length >= 5) break;
    }

    // The screen's own frame (Page from packages/ui); the last one is the one on top.
    const mains = [...document.querySelectorAll('main')];
    const main = mains.at(-1);
    let widthShare = 1;
    if (main?.parentElement) {
      const room = main.parentElement.getBoundingClientRect().width;
      const style = getComputedStyle(main);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const children = [...main.children]
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0);
      const left = Math.min(...children.map((box) => box.left));
      const right = Math.max(...children.map((box) => box.right));
      const used = children.length ? right - left + padding : main.getBoundingClientRect().width;
      widthShare = room > 0 ? Math.min(used, room) / room : 1;
    }

    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport),
      offscreen,
      widthShare,
    };
  });
}
