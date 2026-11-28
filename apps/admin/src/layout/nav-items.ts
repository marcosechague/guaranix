import { t } from '@guaranix/shared';
import type { CheckInModes } from '@guaranix/shared/api';
import {
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  ScanLine,
  MessageCircleQuestion,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Gets its own tab on phones; everything else goes under "Más". */
  phoneTab?: true;
  /** Shown only while the box uses this way of checking in. */
  checkInMode?: keyof CheckInModes;
}

/** Tabs that fit in one row on a 360 px phone, next to "Más". */
export const PHONE_TAB_LIMIT = 4;

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: t('admin.nav.home'), icon: LayoutDashboard, phoneTab: true },
  { to: '/alumnos', label: t('admin.nav.members'), icon: Users, phoneTab: true },
  { to: '/clases', label: t('admin.nav.classes'), icon: CalendarDays, phoneTab: true },
  { to: '/entrada', label: t('admin.nav.checkIn'), icon: ScanLine, checkInMode: 'desk' },
  { to: '/wod', label: t('admin.nav.wod'), icon: Dumbbell },
  { to: '/cobros', label: t('admin.nav.payments'), icon: Wallet, phoneTab: true },
  { to: '/planes', label: t('admin.nav.plans'), icon: Ticket },
];

/** Brodi shows the box's money, so only owners and administrators get the link. */
export const BRODI_NAV_ITEM: NavItem = {
  to: '/brodi',
  label: t('admin.nav.brodi'),
  icon: MessageCircleQuestion,
};

/** What the phone bar shows as tabs and what goes under "Más", in sidebar order. */
export function splitForPhone(items: readonly NavItem[]) {
  const tabs = items.filter((item) => item.phoneTab).slice(0, PHONE_TAB_LIMIT);
  return { tabs, more: items.filter((item) => !tabs.includes(item)) };
}

/** Drops what the box turned off in Ajustes; until the box loads, everything shows. */
export function navItemsFor(modes: CheckInModes | undefined): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.checkInMode || !modes || modes[item.checkInMode]);
}
