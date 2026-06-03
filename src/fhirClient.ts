import type { Bundle, Resource } from '@medplum/fhirtypes';

/** Known FHIR Aggregator server bases */
export const FHIR_SERVERS: Record<string, string> = {
  'Google FHIR (Main)': 'https://google-fhir.fhir-aggregator.org',
};

// Runtime base — defaults to dev proxy in dev, real URL in prod
const isDev = import.meta.env.DEV;
let _base = isDev ? '/fhir-proxy' : 'https://google-fhir.fhir-aggregator.org';

export const getBase = () => _base;
export const setBase = (url: string) => {
  _base = url;
};

export async function fhirSearch<T extends Resource>(
  resourceType: string,
  params: Record<string, string> = {}
): Promise<Bundle<T>> {
  const qs = new URLSearchParams(params).toString();
  const url = `${_base}/${resourceType}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<Bundle<T>>;
}

export async function fhirRead<T extends Resource>(
  resourceType: string,
  id: string
): Promise<T> {
  const url = `${_base}/${resourceType}/${id}`;
  const res = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

export function bundleEntries<T extends Resource>(bundle: Bundle<T>): T[] {
  return (bundle.entry ?? []).map((e) => e.resource as T).filter(Boolean);
}
