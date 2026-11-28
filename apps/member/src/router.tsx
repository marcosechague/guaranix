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
    // Full screen too: the code is shown to the entrance scanner, nothing else on screen.
    path: '/entrar',
    lazy: async () => ({
      Component: (await import('./screens/check-in/CheckInPassScreen')).CheckInPassScreen,
    }),
  },
  {
    // Opened by the phone's camera from the poster on the wall; full screen like the entry QR.
    path: '/pared/:code',
    lazy: async () => ({
      Component: (await import('./screens/wall/WallCheckInScreen')).WallCheckInScreen,
    }),
  },
  {
    path: '/wod/guiado/:componentId',
    lazy: async () => ({
      Component: (await import('./screens/guided/GuidedScreen')).GuidedScreen,
    }),
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
        path: 'cuota',
        lazy: async () => ({ Component: (await import('./screens/fees/FeesScreen')).FeesScreen }),
      },
      {
        path: 'cuota/tarjeta',
        lazy: async () => ({ Component: (await import('./screens/card/CardScreen')).CardScreen }),
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
