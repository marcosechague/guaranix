import { t } from '@guaranix/shared';
import { Avatar, Button, FormMessage, TextField } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAddWalkIn } from '../../api/class-attendance';
import { useMembers } from '../../api/queries';
import { checkInMessage } from '../check-in/check-in-message';

const MAX_RESULTS = 6;

/**
 * Someone showed up without booking: find them and add them, with the same
 * rules as the entrance. The answer (in, or why not) stays on screen.
 */
export function WalkInPanel({ classId, takenIds }: { classId: string; takenIds: Set<string> }) {
  const { timeZone } = useBoxClock();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim();
  const members = useMembers(query, 'active');
  const add = useAddWalkIn(classId);
  const results = query.length < 2 ? [] : (members.data ?? []).slice(0, MAX_RESULTS);
  const message = add.data ? checkInMessage(add.data, timeZone) : null;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" size={18} />
        {t('admin.classes.walkIn.open')}
      </Button>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="font-display text-base font-bold">{t('admin.classes.walkIn.title')}</h3>
      <TextField
        label={t('admin.classes.walkIn.search')}
        hint={t('admin.classes.walkIn.hint')}
        type="search"
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {results.length > 0 ? (
        <ul className="flex flex-col divide-y divide-divider">
          {results.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2">
              <Avatar firstName={member.firstName} lastName={member.lastName} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {member.firstName} {member.lastName}
              </span>
              <Button
                variant="secondary"
                disabled={add.isPending || takenIds.has(member.id)}
                onClick={() => add.mutate(member.id)}
              >
                {takenIds.has(member.id)
                  ? t('admin.classes.walkIn.onList')
                  : t('admin.classes.walkIn.add')}
              </Button>
            </li>
          ))}
        </ul>
      ) : query.length >= 2 && !members.isPending ? (
        <p className="text-sm text-text-secondary">{t('admin.classes.walkIn.noResults')}</p>
      ) : null}
      {message ? (
        <FormMessage tone={message.tone === 'success' ? 'success' : 'error'}>
          <span className="block font-semibold">{message.title}</span>
          {message.detail}
        </FormMessage>
      ) : null}
      {add.isError ? <FormMessage tone="error">{errorText(add.error)}</FormMessage> : null}
    </section>
  );
}
