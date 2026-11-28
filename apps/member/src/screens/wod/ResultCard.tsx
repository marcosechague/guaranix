import { t } from '@guaranix/shared';
import type { LeaderboardEntry, WorkoutComponent } from '@guaranix/shared/api';
import type { Scaling } from '@guaranix/shared/domain';
import { Button, Card, Eyebrow, SegmentedControl, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useId, useState } from 'react';
import { useLogResult } from '../../api/mutations';
import { PrCelebration } from './PrCelebration';
import { EMPTY_SCORE_TEXT, parseScore, type ScoreText, scoreToText } from './score-form';

export interface ResultCardProps {
  component: WorkoutComponent;
  ownEntry: LeaderboardEntry | undefined;
}

const fieldClass =
  'min-h-14 w-full rounded-md border bg-surface-sunken px-4 font-display text-3xl font-bold tabular-nums text-text outline-none placeholder:text-text-secondary/60 focus-visible:border-accent';

function ScoreInput({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  inputMode = 'numeric',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid: boolean;
  inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} ${invalid ? 'border-warning' : 'border-border'}`}
      />
    </div>
  );
}

/** One screen, one save: score, Rx or scaled, done. */
export function ResultCard({ component, ownEntry }: ResultCardProps) {
  const [text, setText] = useState<ScoreText>(() =>
    ownEntry ? scoreToText(ownEntry) : EMPTY_SCORE_TEXT,
  );
  const [scaling, setScaling] = useState<Scaling>(ownEntry?.scaling ?? 'rx');
  const [invalidField, setInvalidField] = useState<keyof ScoreText | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const logResult = useLogResult();
  const toast = useToast();
  const set = (field: keyof ScoreText) => (value: string) => {
    setInvalidField(null);
    setText((current) => ({ ...current, [field]: value }));
  };

  const save = () => {
    const parsed = parseScore(component.scoreType, text);
    if (!parsed.ok) {
      setInvalidField(parsed.field);
      return;
    }
    logResult.mutate(
      { componentId: component.id, scaling, notes: null, ...parsed.score },
      {
        onSuccess: ({ isPersonalRecord }) => {
          if (isPersonalRecord) setCelebrate(true);
          else toast.show(t('member.wod.saved'));
        },
        onError: (error) => toast.show(errorText(error), 'error'),
      },
    );
  };

  const fields = (() => {
    switch (component.scoreType) {
      case 'time':
        return (
          <ScoreInput
            label={t('member.wod.time')}
            value={text.time}
            onChange={set('time')}
            placeholder="9:42"
            inputMode="text"
            invalid={invalidField === 'time'}
          />
        );
      case 'rounds_reps':
        return (
          <>
            <ScoreInput
              label={t('member.wod.rounds')}
              value={text.rounds}
              onChange={set('rounds')}
              placeholder="7"
              invalid={invalidField === 'rounds'}
            />
            <ScoreInput
              label={t('member.wod.reps')}
              value={text.reps}
              onChange={set('reps')}
              placeholder="12"
              invalid={invalidField === 'reps'}
            />
          </>
        );
      case 'load':
        return (
          <ScoreInput
            label={t('member.wod.load')}
            value={text.load}
            onChange={set('load')}
            placeholder="80"
            inputMode="decimal"
            invalid={invalidField === 'load'}
          />
        );
      case 'reps':
      case 'distance':
      case 'calories':
      case 'points':
        return (
          <ScoreInput
            label={t(`member.wod.${component.scoreType}`)}
            value={text.value}
            onChange={set('value')}
            placeholder="0"
            invalid={invalidField === 'value'}
          />
        );
      case 'none':
        return null;
    }
  })();

  return (
    <Card className="relative flex flex-col gap-4 overflow-hidden">
      <Eyebrow>{t('member.wod.yourResult')}</Eyebrow>
      <div className="flex items-end gap-3">{fields}</div>
      {invalidField ? (
        <p role="alert" className="-mt-2 text-sm text-warning">
          {invalidField === 'time' ? t('member.wod.invalidTime') : t('member.wod.invalidNumber')}
        </p>
      ) : null}
      <SegmentedControl
        label={t('member.wod.scaling')}
        value={scaling}
        onChange={setScaling}
        options={[
          { value: 'rx', label: t('common.rx') },
          { value: 'scaled', label: t('common.scaledLong') },
        ]}
      />
      <Button
        onClick={save}
        disabled={logResult.isPending}
        className="bg-text text-background hover:bg-text-soft"
      >
        {logResult.isPending
          ? t('common.saving')
          : ownEntry
            ? t('member.wod.updateResult')
            : t('member.wod.saveResult')}
      </Button>
      <PrCelebration show={celebrate} onDone={() => setCelebrate(false)} />
    </Card>
  );
}
