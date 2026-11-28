import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';

// Each screen is its own chunk so the first load on 3G only brings the home.
export const router = createBrowserRouter([
  {
    // Full screen, without tab bar or side menu: nothing to tap by mistake mid-workout.
    path: '/wod/timer/:componentId',
    lazy: async () => ({ Component: (await import('./screens/timer/TimerScreen')).TimerScreen }),
  },
  {
    path: '/',
    Component: AppShell,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('./screens/home/HomeScreen')).HomeScreen }),
      },
      {
        path: 'reservar',
        lazy: async () => ({ Component: (await import('./screens/book/BookScreen')).BookScreen }),
      },
      {
        path: 'wod',
        lazy: async () => ({ Component: (await import('./screens/wod/WodScreen')).WodScreen }),
      },
      {
        path: 'progreso',
        lazy: async () => ({
          Component: (await import('./screens/progress/ProgressScreen')).ProgressScreen,
        }),
      },
      {
        path: 'perfil',
        lazy: async () => ({
          Component: (await import('./screens/profile/ProfileScreen')).ProfileScreen,
        }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('./screens/home/HomeScreen')).HomeScreen }),
      },
    ],
  },
]);
