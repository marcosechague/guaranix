import { formatScore, t } from '@guaranix/shared';
import type { Leaderboard } from '@guaranix/shared/api';
import { Avatar, Badge, classNames, Eyebrow, Skeleton } from '@guaranix/ui';
import { HandFist } from 'lucide-react';
import { motion } from 'motion/react';
import { useFistBump } from '../../api/mutations';

export interface WhiteboardProps {
  componentId: string;
  board: Leaderboard | undefined;
  isPending: boolean;
  ownMemberId: string | undefined;
}

export function Whiteboard({ componentId, board, isPending, ownMemberId }: WhiteboardProps) {
  const fistBump = useFistBump(componentId);
  return (
    <section aria-labelledby="whiteboard-title" className="flex flex-col gap-3">
      <Eyebrow id="whiteboard-title" className="px-1">
        {t('member.wod.board')}
      </Eyebrow>
      {isPending || !board ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : board.entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-text-secondary">
          {t('member.wod.boardEmpty')}
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-divider rounded-xl border border-border bg-surface">
          {board.entries.map((entry, index) => {
            const mine = entry.memberId === ownMemberId;
            const name = `${entry.firstName} ${entry.lastName.charAt(0)}.`;
            return (
              <li
                key={entry.id}
                className={classNames(
                  'flex items-center gap-3 px-4 py-3',
                  mine && 'bg-accent-soft first:rounded-t-xl last:rounded-b-xl',
                )}
              >
                <span
                  className={classNames(
                    'w-6 text-center font-display font-bold tabular-nums',
                    index < 3 ? 'text-accent-text' : 'text-text-secondary',
                  )}
                >
                  {index + 1}
                </span>
                <Avatar firstName={entry.firstName} lastName={entry.lastName} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {mine ? t('member.wod.you') : name}
                  </span>
                  <Badge
                    tone={entry.scaling === 'rx' ? 'outline' : 'neutral'}
                    className="w-fit px-2 py-0.5 text-[10px]"
                  >
                    {entry.scaling === 'rx' ? t('common.rx') : t('common.scaledLong')}
                  </Badge>
                </span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {formatScore(board.component.scoreType, entry)}
                </span>
                {mine ? (
                  <span className="flex min-w-14 items-center justify-end gap-1 text-sm text-text-secondary tabular-nums">
                    <HandFist aria-hidden="true" size={16} />
                    {entry.fistBumps}
                  </span>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    aria-pressed={entry.bumpedByMe}
                    aria-label={
                      entry.bumpedByMe
                        ? t('member.wod.fistBumpUndo', { name: entry.firstName })
                        : t('member.wod.fistBump', { name: entry.firstName })
                    }
                    onClick={() => fistBump.mutate(entry.id)}
                    className={classNames(
                      'flex min-h-touch min-w-14 items-center justify-center gap-1 rounded-pill border px-2.5 text-sm font-semibold tabular-nums',
                      entry.bumpedByMe
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-border text-text-secondary hover:text-text',
                    )}
                  >
                    <HandFist aria-hidden="true" size={16} />
                    {entry.fistBumps}
                  </motion.button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
