import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@medplum/react/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MedplumProvider } from '@medplum/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import {
  createDefaultR5SchemaProvider,
  SchemaAwareMedplumClient,
  setFhirSchemaProvider,
} from './fhirSchemaProvider';
import { setCrudProvider } from './localCrudStore';
// import { createCustomBackendCrudProvider } from './plugins/customBackendCrudProvider';

// In dev the Vite proxy rewrites /fhir-proxy → https://google-fhir.fhir-aggregator.org
// to sidestep browser CORS restrictions.
const isDev = import.meta.env.DEV;
const configuredFhirBaseUrl = import.meta.env.VITE_FHIR_BASE_URL?.trim();
const configuredSchemaBaseUrl = import.meta.env.VITE_SCHEMA_BASE_URL?.trim();

const ensureTrailingSlash = (url: string): string =>
  url.endsWith('/') ? url : `${url}/`;

const toAbsoluteHttpUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) {
    return ensureTrailingSlash(url);
  }

  if (url.startsWith('/')) {
    return ensureTrailingSlash(new URL(url, window.location.origin).toString());
  }

  return ensureTrailingSlash(url);
};

const toDevSchemaProxyUrl = (url: string): string => {
  if (!isDev) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://hl7.org' || !parsed.pathname.startsWith('/fhir/')) {
      return url;
    }

    const schemaPath = parsed.pathname.replace(/^\/fhir\/?/, '');
    return `${window.location.origin}/schema-proxy/${schemaPath}`;
  } catch {
    return url;
  }
};

const fhirBaseUrl = toAbsoluteHttpUrl(
  configuredFhirBaseUrl
    ? configuredFhirBaseUrl
    : isDev
      ? window.location.origin + '/fhir-proxy/'
      : 'https://google-fhir.fhir-aggregator.org/'
);

const schemaBaseUrl = configuredSchemaBaseUrl
  ? toDevSchemaProxyUrl(configuredSchemaBaseUrl)
  : isDev
    ? window.location.origin + '/schema-proxy/R5'
    : 'https://hl7.org/fhir/R5';

setFhirSchemaProvider(
  createDefaultR5SchemaProvider({
    baseUrl: schemaBaseUrl,
  })
);

export const medplum = new SchemaAwareMedplumClient({
  baseUrl: fhirBaseUrl,
  fhirUrlPath: '',
  onUnauthenticated: () => { /* public server — no auth required */ },
});

const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'Inter, system-ui, sans-serif',
});

// Optional plugin swap point for CRUD persistence.
// setCrudProvider(createCustomBackendCrudProvider({ baseUrl: 'https://your-crud-api.example.com' }));
// Optional plugin swap point for schema access.
// setFhirSchemaProvider(createCustomFhirSchemaProvider({ ... }));
void setCrudProvider;

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
