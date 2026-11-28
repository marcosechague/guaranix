import { t } from '@guaranix/shared';
import { Button, FormMessage, PositionError, TextField, getDevicePosition } from '@guaranix/ui';
import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

export interface CoordinateValues {
  latitude: string;
  longitude: string;
}

/** Six decimals is about 10 cm, more than a phone's GPS can tell. */
const DECIMALS = 6;

/**
 * Where the location is, for the wall QR. Easiest from a phone standing in the box;
 * typing them (copied from a map) works too.
 */
export function LocationCoordinatesFields<Values extends CoordinateValues>({
  form,
}: {
  form: UseFormReturn<Values>;
}) {
  // react-hook-form can't narrow a generic form to these two fields on its own.
  const fields = form as unknown as UseFormReturn<CoordinateValues>;
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { errors } = fields.formState;
  const invalid = errors.latitude || errors.longitude ? t('locations.coordinatesInvalid') : null;

  const locate = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const position = await getDevicePosition();
      const options = { shouldDirty: true, shouldValidate: true };
      fields.setValue('latitude', position.latitude.toFixed(DECIMALS), options);
      fields.setValue('longitude', position.longitude.toFixed(DECIMALS), options);
    } catch (error) {
      const denied = error instanceof PositionError && error.problem === 'denied';
      setProblem(denied ? t('locations.locateDenied') : t('locations.locateFailed'));
    } finally {
      setLocating(false);
    }
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{t('locations.coordinates')}</legend>
      <p className="text-sm text-text-secondary">{t('locations.coordinatesHint')}</p>
      <Button type="button" variant="secondary" disabled={locating} onClick={() => void locate()}>
        <LocateFixed aria-hidden="true" size={18} />
        {locating ? t('locations.locating') : t('locations.locateHere')}
      </Button>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('locations.latitude')}
          inputMode="decimal"
          placeholder="-25.2867"
          {...fields.register('latitude')}
        />
        <TextField
          label={t('locations.longitude')}
          inputMode="decimal"
          placeholder="-57.6470"
          {...fields.register('longitude')}
        />
      </div>
      {problem ? <FormMessage tone="error">{problem}</FormMessage> : null}
      {invalid ? <FormMessage tone="error">{invalid}</FormMessage> : null}
    </fieldset>
  );
}
