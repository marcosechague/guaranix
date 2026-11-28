import { PARAGUAY_DEPARTMENTS, isParaguayCity, t } from '@guaranix/shared';
import { SelectField, type SelectFieldProps } from './SelectField';

export interface CitySelectFieldProps extends Omit<SelectFieldProps, 'value' | 'children'> {
  value: string;
}

/**
 * A city of Paraguay, grouped by department. A value saved before the list
 * existed (free text) stays selectable so editing never drops it.
 */
export function CitySelectField({ value, ...props }: CitySelectFieldProps) {
  const legacy = value && !isParaguayCity(value) ? value : null;
  return (
    <SelectField value={value} {...props}>
      <option value="">{t('common.chooseCity')}</option>
      {legacy ? <option value={legacy}>{t('common.otherCity', { city: legacy })}</option> : null}
      {PARAGUAY_DEPARTMENTS.map((department) => (
        <optgroup key={department.name} label={department.name}>
          {department.cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
