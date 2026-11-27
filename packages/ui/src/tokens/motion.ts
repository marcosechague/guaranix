/** Keep animations short and cheap: only `transform` and `opacity`, never over 400 ms. */
export const durations = {
  fast: 150,
  base: 200,
  slow: 250,
} as const;

export const easings = {
  out: [0.22, 1, 0.36, 1],
} as const;

/** Minimum touch target in px (WCAG 2.5.5 / platform guidelines). */
export const minTouchTarget = 44;
