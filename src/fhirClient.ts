import type { Bundle, Resource } from '@medplum/fhirtypes';
import {
  applyLocalResourceListOverlay,
  applyLocalResourceOverlay,
  getLocalResourceDraft,
  isLocallyDeleted,
  LocallyDeletedResourceError,
} from './localCrudStore';

/** Known FHIR Aggregator server bases */
export const FHIR_SERVERS: Record<string, string> = {
  'Google FHIR (Main)': 'https://google-fhir.fhir-aggregator.org',
};

// Runtime base — defaults to dev proxy in dev, real URL in prod
const isDev = import.meta.env.DEV;
const configuredBase = import.meta.env.VITE_FHIR_BASE_URL?.trim();
const normalizeBase = (url: string): string => url.replace(/\/+$/, '');
let _base = normalizeBase(
  configuredBase && configuredBase.length > 0
    ? configuredBase
    : isDev
      ? '/fhir-proxy'
      : 'https://google-fhir.fhir-aggregator.org'
);

export const getBase = () => _base;
export const setBase = (url: string) => {
  _base = normalizeBase(url);
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
  if (isLocallyDeleted(resourceType, id)) {
    throw new LocallyDeletedResourceError(resourceType, id);
  }

  const localDraft = getLocalResourceDraft<T>(resourceType, id);
  if (localDraft?.mode === 'created') {
    return localDraft.resource;
  }

  const url = `${_base}/${resourceType}/${id}`;
  const res = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
  if (!res.ok) {
    if (localDraft) {
      return localDraft.resource;
    }

    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }

  const resource = await res.json() as T;
  const overlay = applyLocalResourceOverlay(resource);
  if (!overlay) {
    throw new LocallyDeletedResourceError(resourceType, id);
  }

  return overlay;
}

export function bundleEntries<T extends Resource>(bundle: Bundle<T>): T[] {
  return applyLocalResourceListOverlay(
    (bundle.entry ?? []).map((e) => e.resource as T).filter(Boolean)
  );
}
