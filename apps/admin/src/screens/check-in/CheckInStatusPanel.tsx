import { t } from '@guaranix/shared';
import { StatusPanel, type StatusTone } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { checkInMessage } from './check-in-message';
import type { DeskState } from './use-check-in-desk';

interface PanelContent {
  tone: StatusTone;
  title: string;
  detail: string;
}

function contentOf(state: DeskState, timeZone: string): PanelContent {
  if (state.kind === 'waiting') {
    return {
      tone: 'neutral',
      title: t('admin.checkIn.waitingTitle'),
      detail: t('admin.checkIn.waitingBody'),
    };
  }
  if (state.kind === 'checking')
    return { tone: 'neutral', title: t('admin.checkIn.checking'), detail: '' };
  if (state.kind === 'error') return { tone: 'warning', title: errorText(state.error), detail: '' };
  return checkInMessage(state.result, timeZone);
}

/** The big answer at the door: green to go in, orange to stop by the front desk. */
export function CheckInStatusPanel({ state }: { state: DeskState }) {
  const { timeZone } = useBoxClock();
  const content = contentOf(state, timeZone);
  return (
    <StatusPanel
      {...content}
      busy={state.kind === 'checking'}
      stateKey={
        state.kind === 'result' ? state.result.member.id + state.result.outcome : state.kind
      }
    />
  );
}
