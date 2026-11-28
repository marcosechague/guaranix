import { t, type BrodiOverview } from '@guaranix/shared';
import { Brodi, Button, Card, FormMessage } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useEffect, useRef } from 'react';
import { useAskBrodi } from '../../api/brodi';
import { BrodiAskForm } from './BrodiAskForm';
import { BrodiMessages } from './BrodiMessages';
import { questionsLeft, usageText } from './usage';

const SUGGESTIONS = ['collected', 'absent', 'debtors', 'expiring'] as const;

function Suggestions({
  onAsk,
  disabled,
}: {
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Brodi alt="" size={72} className="shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-semibold">{t('admin.brodi.emptyTitle')}</p>
          <p className="text-sm text-text-soft">{t('admin.brodi.emptyBody')}</p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label={t('admin.brodi.suggestionsLabel')}>
        {SUGGESTIONS.map((key) => (
          <li key={key}>
            <Button
              variant="secondary"
              className="rounded-pill text-sm font-medium"
              disabled={disabled}
              onClick={() => onAsk(t(`admin.brodi.suggestions.${key}`))}
            >
              {t(`admin.brodi.suggestions.${key}`)}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Questions and answers with Brodi. Read-only: it never changes box data. */
export function BrodiConversation({ overview }: { overview: BrodiOverview }) {
  const ask = useAskBrodi();
  const bottom = useRef<HTMLDivElement>(null);
  const exhausted = questionsLeft(overview.usage) === 0;
  const pending = ask.isPending ? ask.variables : null;
  const count = overview.messages.length;

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [count, pending]);

  const send = (question: string) => {
    ask.reset();
    ask.mutate(question);
  };

  return (
    <Card className="flex flex-col gap-5">
      {count === 0 && !pending ? (
        <Suggestions onAsk={send} disabled={exhausted || ask.isPending} />
      ) : (
        <div className="max-h-128 overflow-y-auto pr-1">
          <BrodiMessages messages={overview.messages} pendingQuestion={pending ?? null} />
          <div ref={bottom} />
        </div>
      )}
      {ask.isError ? <FormMessage tone="error">{errorText(ask.error)}</FormMessage> : null}
      <div className="flex flex-col gap-2 border-t border-divider pt-4">
        <BrodiAskForm onAsk={send} busy={ask.isPending} disabled={exhausted} />
        <p className="text-xs text-text-secondary">
          {usageText(overview.usage)} {t('admin.brodi.readOnly')}
        </p>
      </div>
    </Card>
  );
}
