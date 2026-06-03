import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@medplum/react/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MedplumClient } from '@medplum/core';
import { MedplumProvider } from '@medplum/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// In dev the Vite proxy rewrites /fhir-proxy → https://google-fhir.fhir-aggregator.org
// to sidestep browser CORS restrictions.
const isDev = import.meta.env.DEV;

export const medplum = new MedplumClient({
  baseUrl: isDev
    ? window.location.origin + '/fhir-proxy/'
    : 'https://google-fhir.fhir-aggregator.org/',
  fhirUrlPath: '',
  onUnauthenticated: () => { /* public server — no auth required */ },
});

const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'Inter, system-ui, sans-serif',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MantineProvider theme={theme}>
        <Notifications />
        <MedplumProvider medplum={medplum}>
          <App />
        </MedplumProvider>
      </MantineProvider>
    </BrowserRouter>
  </StrictMode>
);
