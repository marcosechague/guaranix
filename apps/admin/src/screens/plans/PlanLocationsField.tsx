import { t } from '@guaranix/shared';
import { ToggleChips } from '@guaranix/ui';
import { useLocations } from '@guaranix/ui/data';

export interface PlanLocationsFieldProps {
  value: string[];
  onChange: (locationIds: string[]) => void;
}

/** The pass between locations: no chip picked means the plan works everywhere. */
export function PlanLocationsField({ value, onChange }: PlanLocationsFieldProps) {
  const locations = useLocations();
  const open = (locations.data ?? []).filter(
    (location) => location.isActive || value.includes(location.id),
  );
  if (open.length < 2) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-soft">{t('locations.planScope')}</span>
      <ToggleChips
        className="flex-wrap"
        label={t('locations.planScope')}
        value={value}
        onChange={onChange}
        options={open.map((location) => ({ value: location.id, label: location.name }))}
      />
      <span className="text-sm text-text-secondary">
        {value.length === 0 ? t('locations.planEverywhere') : t('locations.planSome')}
        {' · '}
        {t('locations.planSomeHint')}
      </span>
    </div>
  );
}
