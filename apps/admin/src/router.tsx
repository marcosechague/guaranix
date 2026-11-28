import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';

const home = async () => ({ Component: (await import('./screens/home/HomeScreen')).HomeScreen });
const members = async () => ({
  Component: (await import('./screens/members/MembersScreen')).MembersScreen,
});

// One chunk per section, so a phone at the front desk loads only what it opens.
export const router = createBrowserRouter([
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
        path: 'cuenta',
        lazy: async () => ({
          Component: (await import('./screens/account/AccountScreen')).AccountScreen,
        }),
      },
      { path: '*', lazy: home },
    ],
  },
]);
