import { t } from '@guaranix/shared';
import { ChevronRight, CreditCard } from 'lucide-react';
import { Link } from 'react-router';

/** Entry to "Mi tarjeta" from the member's profile and fee screens. */
export function CardEntryLink() {
  return (
    <Link
      to="/cuota/tarjeta"
      className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
    >
      <CreditCard aria-hidden="true" size={22} className="text-accent" />
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{t('member.cards.entryTitle')}</span>
        <span className="text-sm text-text-secondary">{t('member.cards.entryHint')}</span>
      </span>
      <ChevronRight aria-hidden="true" size={18} className="text-text-secondary" />
    </Link>
  );
}
