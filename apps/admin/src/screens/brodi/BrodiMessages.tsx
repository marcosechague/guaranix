import { formatTimeIn, t, type BrodiMessage } from '@guaranix/shared';
import { Brodi, classNames } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';

function Bubble({ message, timeZone }: { message: BrodiMessage; timeZone: string }) {
  const mine = message.role === 'user';
  return (
    <li className={classNames('flex gap-3', mine ? 'justify-end' : 'justify-start')}>
      {mine ? null : <Brodi alt="" size={32} className="mt-1 shrink-0" />}
      <div
        className={classNames(
          'flex max-w-xl flex-col gap-1 rounded-lg px-4 py-3',
          mine ? 'bg-accent text-on-accent' : 'border border-border bg-surface-sunken',
        )}
      >
        <span className="sr-only">{mine ? t('admin.brodi.you') : t('brodi.name')}</span>
        <p className="text-sm whitespace-pre-line">{message.content}</p>
        <time
          dateTime={message.createdAt}
          className={classNames('text-micro', mine ? 'text-on-accent/70' : 'text-text-secondary')}
        >
          {formatTimeIn(timeZone, message.createdAt)}
        </time>
      </div>
    </li>
  );
}

/** The conversation, newest at the bottom; the question being asked shows right away. */
export function BrodiMessages({
  messages,
  pendingQuestion,
}: {
  messages: BrodiMessage[];
  pendingQuestion: string | null;
}) {
  const { timeZone: zone } = useBoxClock();
  return (
    <ol
      aria-label={t('admin.brodi.conversation')}
      aria-live="polite"
      className="flex flex-col gap-4"
    >
      {messages.map((message) => (
        <Bubble key={message.id} message={message} timeZone={zone} />
      ))}
      {pendingQuestion ? (
        <>
          <Bubble
            message={{
              id: 'pending',
              role: 'user',
              content: pendingQuestion,
              createdAt: new Date().toISOString(),
            }}
            timeZone={zone}
          />
          <li className="flex items-center gap-3 text-sm text-text-secondary">
            <Brodi alt="" size={32} className="shrink-0" />
            {t('admin.brodi.thinking')}
          </li>
        </>
      ) : null}
    </ol>
  );
}
