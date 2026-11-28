import { describe, expect, it } from 'vitest';
import { Ticket } from 'lucide-react';
import { NAV_ITEMS, PHONE_TAB_LIMIT, splitForPhone } from './nav-items';

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
