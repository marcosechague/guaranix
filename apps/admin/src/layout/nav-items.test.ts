import { describe, expect, it } from 'vitest';
import { Ticket } from 'lucide-react';
import { NAV_ITEMS, PHONE_TAB_LIMIT, navItemsFor, splitForPhone } from './nav-items';

describe('splitForPhone', () => {
  it('keeps the phone bar to one row and loses no section', () => {
    const { tabs, more } = splitForPhone(NAV_ITEMS);
    expect(tabs.length).toBeLessThanOrEqual(PHONE_TAB_LIMIT);
    expect([...tabs, ...more].map((item) => item.to).sort()).toEqual(
      NAV_ITEMS.map((item) => item.to).sort(),
    );
  });

  it('sends new sections to "Más" unless they ask for a tab, and caps the tabs', () => {
    const extra = Array.from({ length: 3 }, (_, index) => ({
      to: `/extra-${index}`,
      label: `Extra ${index}`,
      icon: Ticket,
      phoneTab: true as const,
    }));
    const { tabs, more } = splitForPhone([...NAV_ITEMS, ...extra]);
    expect(tabs).toHaveLength(PHONE_TAB_LIMIT);
    expect(more.map((item) => item.to)).toContain('/extra-2');
  });
});

describe('navItemsFor', () => {
  const paths = (items: readonly { to: string }[]) => items.map((item) => item.to);

  it('hides the entrance when the box turned it off, and only then', () => {
    const on = { desk: true, coach: true, wallQr: false };
    expect(paths(navItemsFor(on))).toEqual(paths(NAV_ITEMS));
    expect(paths(navItemsFor(undefined))).toEqual(paths(NAV_ITEMS));
    expect(paths(navItemsFor({ ...on, desk: false }))).not.toContain('/entrada');
  });
});
