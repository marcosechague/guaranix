import { ChipGroup } from './ChipGroup';

/** Value of the "every location" chip. */
export const ALL_LOCATIONS = 'all';

interface Located {
  locationId: string;
  locationName: string;
}

/** Locations that appear in a list of classes, in order of first appearance. */
export function locationsIn(items: readonly Located[]): { value: string; label: string }[] {
  const byId = new Map(items.map((item) => [item.locationId, item.locationName]));
  return [...byId.entries()].map(([value, label]) => ({ value, label }));
}

export function atLocation<T extends Located>(items: readonly T[], location: string): T[] {
  return location === ALL_LOCATIONS
    ? [...items]
    : items.filter((item) => item.locationId === location);
}

export interface LocationChipsProps {
  label: string;
  allLabel: string;
  items: readonly Located[];
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}

/** "Todas las sedes · Centro · Villa Morra". Hidden while the classes are all at one location. */
export function LocationChips({
  label,
  allLabel,
  items,
  value,
  onChange,
  className,
}: LocationChipsProps) {
  const options = locationsIn(items);
  if (options.length < 2) return null;
  return (
    <ChipGroup
      className={className}
      label={label}
      value={value}
      onChange={onChange}
      options={[{ value: ALL_LOCATIONS, label: allLabel }, ...options]}
    />
  );
}
