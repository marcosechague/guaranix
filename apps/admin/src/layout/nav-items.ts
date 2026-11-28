import { t } from '@guaranix/shared';
import {
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: t('admin.nav.home'), icon: LayoutDashboard },
  { to: '/alumnos', label: t('admin.nav.members'), icon: Users },
  { to: '/clases', label: t('admin.nav.classes'), icon: CalendarDays },
  { to: '/wod', label: t('admin.nav.wod'), icon: Dumbbell },
  { to: '/cobros', label: t('admin.nav.payments'), icon: Wallet },
  { to: '/planes', label: t('admin.nav.plans'), icon: Ticket },
];
