import { type ComponentType, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/** Mounts an app's root component on `#root`; shared by member, admin and platform. */
export function renderApp(App: ComponentType) {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Missing #root element');
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
