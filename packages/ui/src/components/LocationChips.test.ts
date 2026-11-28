import { describe, expect, it } from 'vitest';
import { ALL_LOCATIONS, atLocation, locationsIn } from './LocationChips';

const items = [
  { id: 'a', locationId: 'centro', locationName: 'Centro' },
  { id: 'b', locationId: 'villa', locationName: 'Villa Morra' },
  { id: 'c', locationId: 'centro', locationName: 'Centro' },
];

describe('location chips', () => {
  it('lists each location once, in order of appearance', () => {
    expect(locationsIn(items)).toEqual([
      { value: 'centro', label: 'Centro' },
      { value: 'villa', label: 'Villa Morra' },
    ]);
  });

  it('keeps every class for "all" and only one location otherwise', () => {
    expect(atLocation(items, ALL_LOCATIONS).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(atLocation(items, 'centro').map((item) => item.id)).toEqual(['a', 'c']);
  });
});
