import { formatKilograms, stepLoadGrams, t } from '@guaranix/shared';
import { Card, Eyebrow, IconButton } from '@guaranix/ui';
import { Minus, Plus } from 'lucide-react';
import type { LoadSuggestion } from './use-suggested-load';

export interface LoadPickerProps {
  loadGrams: number | null;
  onChange(loadGrams: number): void;
  suggestion: LoadSuggestion | null;
  movementName: string | null;
}

/** One tap to accept the suggestion (it's already set), + and − to change it. */
export function LoadPicker({ loadGrams, onChange, suggestion, movementName }: LoadPickerProps) {
  const current = loadGrams ?? 0;
  return (
    <Card spacing="compact">
      <Eyebrow>
        {suggestion ? t('member.guided.suggestedLoad') : t('member.guided.yourLoad')}
      </Eyebrow>
      <div className="flex items-center gap-4">
        <IconButton
          label={t('member.guided.lessLoad')}
          className="size-14"
          disabled={current === 0}
          onClick={() => onChange(stepLoadGrams(current, -1))}
        >
          <Minus aria-hidden="true" size={22} />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <p
            aria-live="polite"
            className="font-display text-4xl font-bold tabular-nums"
            data-testid="guided-load"
          >
            {loadGrams === null ? '—' : formatKilograms(loadGrams)}
          </p>
          <p className="text-sm text-text-secondary">
            {suggestion
              ? t('member.guided.suggestedFrom', {
                  percent: suggestion.percent,
                  movement: suggestion.movementName,
                  best: formatKilograms(suggestion.bestGrams),
                })
              : t('member.guided.noRecord', { movement: movementName ?? '' })}
          </p>
        </div>
        <IconButton
          label={t('member.guided.moreLoad')}
          className="size-14"
          onClick={() => onChange(stepLoadGrams(current, 1))}
        >
          <Plus aria-hidden="true" size={22} />
        </IconButton>
      </div>
    </Card>
  );
}
