import { t } from '@guaranix/shared';
import type { Location } from '@guaranix/shared/api';
import { Badge, Button, Card, IconButton, Skeleton } from '@guaranix/ui';
import { LoadError, useLocations } from '@guaranix/ui/data';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { LocationFormSheet } from './LocationFormSheet';

const addressLine = (location: Location) =>
  [location.address, location.city].filter(Boolean).join(', ');

function LocationRow({ location, onEdit }: { location: Location; onEdit: (() => void) | null }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <MapPin aria-hidden="true" size={18} className="shrink-0 text-text-secondary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 font-semibold">
          <span className="truncate">{location.name}</span>
          {location.isDefault ? <Badge tone="accent">{t('locations.default')}</Badge> : null}
          {location.isActive ? null : <Badge tone="neutral">{t('locations.closed')}</Badge>}
        </span>
        {addressLine(location) ? (
          <span className="truncate text-sm text-text-secondary">{addressLine(location)}</span>
        ) : null}
      </span>
      {onEdit ? (
        <IconButton
          variant="ghost"
          label={t('locations.editLabel', { name: location.name })}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" size={17} />
        </IconButton>
      ) : null}
    </li>
  );
}

export function LocationsCard({ editable }: { editable: boolean }) {
  const locations = useLocations();
  // `null` is the new-location form; undefined means the sheet is closed.
  const [editing, setEditing] = useState<Location | null | undefined>(undefined);
  const rows = locations.data ?? [];

  return (
    <Card as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t('locations.title')}</h2>
          <p className="text-sm text-text-secondary">
            {rows.length === 1 ? t('locations.single') : t('locations.hint')}
          </p>
        </div>
        {editable ? (
          <Button variant="secondary" onClick={() => setEditing(null)}>
            <Plus aria-hidden="true" size={18} />
            {t('locations.add')}
          </Button>
        ) : null}
      </div>
      {locations.isPending ? (
        <Skeleton className="h-16" />
      ) : locations.isError ? (
        <LoadError error={locations.error} onRetry={() => void locations.refetch()} />
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {rows.map((location) => (
            <LocationRow
              key={location.id}
              location={location}
              onEdit={editable ? () => setEditing(location) : null}
            />
          ))}
        </ul>
      )}
      {editing !== undefined ? (
        <LocationFormSheet location={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </Card>
  );
}
