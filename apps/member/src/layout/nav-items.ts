import { t } from '@guaranix/shared';
import {
  CalendarDays,
  Dumbbell,
  House,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ITEMS: readonly { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t('member.nav.home'), icon: House },
  { to: '/reservar', label: t('member.nav.book'), icon: CalendarDays },
  { to: '/wod', label: t('member.nav.wod'), icon: Dumbbell },
  { to: '/progreso', label: t('member.nav.progress'), icon: TrendingUp },
  { to: '/perfil', label: t('member.nav.profile'), icon: UserRound },
];
