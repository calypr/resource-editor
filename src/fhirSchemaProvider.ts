import {
  MedplumClient,
  indexStructureDefinitionBundle,
  tryGetDataType,
  tryGetProfile,
  type MedplumClientOptions,
  type RequestProfileSchemaOptions,
} from '@medplum/core';
import type { Bundle, StructureDefinition } from '@medplum/fhirtypes';

const DEFAULT_R5_PROFILE_PREFIX = 'http://hl7.org/fhir/StructureDefinition/';

export interface FhirSchemaProvider {
  requestSchema(resourceType: string): Promise<boolean>;
  requestProfileSchema(profileUrl: string, options?: RequestProfileSchemaOptions): Promise<boolean>;
}

let activeFhirSchemaProvider: FhirSchemaProvider | undefined;

export function setFhirSchemaProvider(provider: FhirSchemaProvider | undefined): void {
  activeFhirSchemaProvider = provider;
}

function normalizeSchemaBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function parseDefaultR5ResourceType(profileUrl: string): string | undefined {
  if (!profileUrl.startsWith(DEFAULT_R5_PROFILE_PREFIX)) {
    return undefined;
  }

  const suffix = profileUrl.slice(DEFAULT_R5_PROFILE_PREFIX.length).trim();
  return suffix || undefined;
}

async function readJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load schema from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export interface DefaultR5SchemaProviderOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createDefaultR5SchemaProvider(options: DefaultR5SchemaProviderOptions = {}): FhirSchemaProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeSchemaBaseUrl(options.baseUrl ?? 'https://hl7.org/fhir/R5');
  let typesPromise: Promise<void> | undefined;

  async function ensureTypesLoaded(): Promise<void> {
    if (tryGetDataType('HumanName')) {
      return;
    }

    if (!typesPromise) {
      typesPromise = readJson<Bundle<StructureDefinition>>(`${baseUrl}/profiles-types.json`, fetchImpl).then((bundle) => {
        indexStructureDefinitionBundle(bundle);
      });
    }

    await typesPromise;
  }

  async function ensureResourceLoaded(resourceType: string): Promise<void> {
    if (tryGetDataType(resourceType)) {
      return;
    }

    await ensureTypesLoaded();

    const profile = await readJson<StructureDefinition>(
      `${baseUrl}/${resourceType.toLowerCase()}.profile.json`,
      fetchImpl
    );
    indexStructureDefinitionBundle([profile]);
  }

  return {
    async requestSchema(resourceType: string): Promise<boolean> {
      await ensureResourceLoaded(resourceType);
      return Boolean(tryGetDataType(resourceType));
    },
    async requestProfileSchema(profileUrl: string): Promise<boolean> {
      await ensureTypesLoaded();

      if (tryGetProfile(profileUrl)) {
        return true;
      }

      const resourceType = parseDefaultR5ResourceType(profileUrl);
      if (!resourceType) {
        return false;
      }

      await ensureResourceLoaded(resourceType);
      return Boolean(tryGetProfile(profileUrl) || tryGetDataType(resourceType));
    },
  };
}

export class SchemaAwareMedplumClient extends MedplumClient {
  constructor(options?: MedplumClientOptions) {
    super(options);
  }

  override async requestSchema(resourceType: string): Promise<void> {
    if (tryGetDataType(resourceType)) {
      return;
    }

    if (activeFhirSchemaProvider) {
      const handled = await activeFhirSchemaProvider.requestSchema(resourceType);
      if (handled) {
        if (tryGetDataType(resourceType)) {
          return;
        }

        throw new Error(`Schema provider did not load schema for ${resourceType}`);
      }
    }

    return super.requestSchema(resourceType);
  }

  override async requestProfileSchema(profileUrl: string, options?: RequestProfileSchemaOptions): Promise<void> {
    if (tryGetProfile(profileUrl)) {
      return;
    }

    if (activeFhirSchemaProvider) {
      const handled = await activeFhirSchemaProvider.requestProfileSchema(profileUrl, options);
      if (handled) {
        if (tryGetProfile(profileUrl)) {
          return;
        }

        const resourceType = parseDefaultR5ResourceType(profileUrl);
        if (resourceType && tryGetDataType(resourceType)) {
          return;
        }

        throw new Error(`Schema provider did not load profile ${profileUrl}`);
      }
    }

    return super.requestProfileSchema(profileUrl, options);
  }
}