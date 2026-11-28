import { createBrowserRouter } from 'react-router';
import { PlatformShell } from './layout/PlatformShell';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: PlatformShell,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./screens/boxes/BoxesScreen')).BoxesScreen,
        }),
      },
      {
        path: 'planes',
        lazy: async () => ({
          Component: (await import('./screens/plans/PlansScreen')).PlansScreen,
        }),
      },
      {
        path: 'ia',
        lazy: async () => ({
          Component: (await import('./screens/ai/AiScreen')).AiScreen,
        }),
      },
      {
        path: '*',
        lazy: async () => ({
          Component: (await import('./screens/boxes/BoxesScreen')).BoxesScreen,
        }),
      },
    ],
  },
]);
