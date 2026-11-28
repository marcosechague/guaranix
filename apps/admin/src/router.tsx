import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';

const home = async () => ({ Component: (await import('./screens/home/HomeScreen')).HomeScreen });
const members = async () => ({
  Component: (await import('./screens/members/MembersScreen')).MembersScreen,
});

// One chunk per section, so a phone at the front desk loads only what it opens.
export const router = createBrowserRouter(
  [
    {
      // Entrance mode: full screen on a tablet at the door, without the panel's menus.
      path: '/entrada',
      lazy: async () => ({
        Component: (await import('./screens/check-in/CheckInScreen')).CheckInScreen,
      }),
    },
    {
      // The printable poster for the wall QR, without menus so it prints clean.
      path: '/cartel/:locationId',
      lazy: async () => ({
        Component: (await import('./screens/wall-poster/WallPosterScreen')).WallPosterScreen,
      }),
    },
    {
      // A coach's or receptionist's own QR, shown full screen at the entrance device.
      path: '/mi-qr',
      lazy: async () => ({
        Component: (await import('./screens/staff-pass/StaffPassScreen')).StaffPassScreen,
      }),
    },
    {
      path: '/',
      Component: AppShell,
      children: [
        { index: true, lazy: home },
        { path: 'alumnos', lazy: members },
        { path: 'alumnos/:memberId', lazy: members },
        {
          path: 'clases',
          lazy: async () => ({
            Component: (await import('./screens/classes/ClassesScreen')).ClassesScreen,
          }),
        },
        {
          path: 'wod',
          lazy: async () => ({ Component: (await import('./screens/wod/WodScreen')).WodScreen }),
        },
        {
          path: 'cobros',
          lazy: async () => ({
            Component: (await import('./screens/payments/PaymentsScreen')).PaymentsScreen,
          }),
        },
        {
          path: 'planes',
          lazy: async () => ({
            Component: (await import('./screens/plans/PlansScreen')).PlansScreen,
          }),
        },
        {
          path: 'ajustes',
          lazy: async () => ({
            Component: (await import('./screens/settings/SettingsScreen')).SettingsScreen,
          }),
        },
        {
          path: 'importar',
          lazy: async () => ({
            Component: (await import('./screens/imports/ImportScreen')).ImportScreen,
          }),
        },
        {
          path: 'brodi',
          lazy: async () => ({
            Component: (await import('./screens/brodi/BrodiScreen')).BrodiScreen,
          }),
        },
        {
          path: 'cuenta',
          lazy: async () => ({
            Component: (await import('./screens/account/AccountScreen')).AccountScreen,
          }),
        },
        { path: '*', lazy: home },
      ],
    },
  ],
  // Vite's base (`/panel/` in production); React Router wants it without the trailing slash.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
