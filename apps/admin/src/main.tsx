import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionProvider } from '@chauffr/ui';
import '@chauffr/ui/styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
