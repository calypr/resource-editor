import type { Resource } from '@medplum/fhirtypes';
import { getBase } from './fhirClient';

export interface CodeFieldOption {
  value: string;
  label: string;
}

export interface CodeFieldDefinition {
  field: string;
  label: string;
  description?: string;
  required?: boolean;
}

export type CodeFieldOverrideValues = Record<string, string | undefined>;

interface StructureDefinitionElement {
  path?: string;
  label?: string;
  shortDisplay?: string;
  short?: string;
  definition?: string;
  min?: number;
  max?: string;
  type?: Array<{
    code?: string;
  }>;
  binding?: {
    valueSet?: string;
  };
}

interface StructureDefinitionResponse {
  snapshot?: {
    element?: StructureDefinitionElement[];
  };
  differential?: {
    element?: StructureDefinitionElement[];
  };
}

interface ValueSetContains {
  code?: string;
  display?: string;
  contains?: ValueSetContains[];
}

interface ValueSetResource {
  url?: string;
  expansion?: {
    contains?: ValueSetContains[];
  };
  compose?: {
    include?: Array<{
      concept?: Array<{
        code?: string;
        display?: string;
      }>;
    }>;
  };
}

interface BundleEntry {
  resource?: ValueSetResource;
}

interface ValueSetBundle {
  entry?: BundleEntry[];
}

const codeFieldOptionsCache = new Map<string, Promise<CodeFieldOption[]>>();
const structureDefinitionCache = new Map<string, Promise<StructureDefinitionResponse | undefined>>();
const valueSetBundleCache = new Map<string, Promise<ValueSetBundle | undefined>>();
const codeFieldDefinitionsCache = new Map<string, CodeFieldDefinition[]>();
const codeFieldDefinitionsPromiseCache = new Map<string, Promise<CodeFieldDefinition[]>>();
const codeFieldValueSetCache = new Map<string, Record<string, string | undefined>>();
const codeFieldShortDisplayCache = new Map<string, Record<string, string | undefined>>();

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function toAbsoluteHttpUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return ensureTrailingSlash(url);
  }

  if (url.startsWith('/')) {
    return ensureTrailingSlash(new URL(url, window.location.origin).toString());
  }

  return ensureTrailingSlash(url);
}

function toDevSchemaProxyUrl(url: string): string {
  if (!import.meta.env.DEV) {
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
}

function getSchemaBaseUrl(): string {
  const configuredSchemaBaseUrl = import.meta.env.VITE_SCHEMA_BASE_URL?.trim();
  if (configuredSchemaBaseUrl) {
    return normalizeBaseUrl(toDevSchemaProxyUrl(configuredSchemaBaseUrl));
  }

  if (import.meta.env.DEV) {
    return `${window.location.origin}/schema-proxy/R5`;
  }

  return 'https://hl7.org/fhir/R5';
}

function getIgTerminologyBases(): string[] {
  const values = [
    import.meta.env.VITE_IG_BASE_URL?.trim(),
    import.meta.env.VITE_SCHEMA_BASE_URL?.trim(),
    getSchemaBaseUrl(),
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return Array.from(new Set(values.map((value) => normalizeBaseUrl(toAbsoluteHttpUrl(toDevSchemaProxyUrl(value))))));
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/fhir+json,application/json' },
    });
    if (!response.ok) {
      return undefined;
    }

    return response.json() as Promise<T>;
  } catch {
    return undefined;
  }
}

async function getStructureDefinition(resourceType: string): Promise<StructureDefinitionResponse | undefined> {
  if (!structureDefinitionCache.has(resourceType)) {
    const schemaBaseUrl = normalizeBaseUrl(getSchemaBaseUrl());
    const profileUrl = `${schemaBaseUrl}/${resourceType.toLowerCase()}.profile.json`;
    structureDefinitionCache.set(resourceType, fetchJson<StructureDefinitionResponse>(profileUrl));
  }

  return structureDefinitionCache.get(resourceType);
}

function isDirectFieldPath(resourceType: string, path: string): boolean {
  if (!path.startsWith(`${resourceType}.`)) {
    return false;
  }

  const segments = path.split('.');
  return segments.length === 2;
}

function toLabel(field: string, fallback?: string): string {
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  const spaced = field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();

  if (!spaced) {
    return field;
  }

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isPipeDelimitedValueList(text: string | undefined): boolean {
  if (!text || !text.includes('|')) {
    return false;
  }

  const values = text
    .split('|')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length >= 2;
}

function inferCodeFieldDefinitions(
  definition: StructureDefinitionResponse | undefined,
  resourceType: string
): CodeFieldDefinition[] {
  return inferCodeFieldSchema(definition, resourceType).definitions;
}

interface ParsedCodeFieldSchema {
  definitions: CodeFieldDefinition[];
  valueSetByField: Record<string, string | undefined>;
  shortDisplayByField: Record<string, string | undefined>;
}

interface ParsedCodeFieldAccumulator {
  isCode: boolean;
  label?: string;
  shortDisplay?: string;
  short?: string;
  definition?: string;
  min?: number;
  valueSet?: string;
}

function inferCodeFieldSchema(
  definition: StructureDefinitionResponse | undefined,
  resourceType: string
): ParsedCodeFieldSchema {
  const elements = [
    ...(definition?.snapshot?.element ?? []),
    ...(definition?.differential?.element ?? []),
  ];

  const accumulators = new Map<string, ParsedCodeFieldAccumulator>();

  elements.forEach((element) => {
    const path = element.path;
    if (!path || !isDirectFieldPath(resourceType, path)) {
      return;
    }

    const field = path.slice(resourceType.length + 1);
    if (!field) {
      return;
    }

    const current = accumulators.get(field) ?? { isCode: false };
    const isCode = (element.type ?? []).some((typeEntry) => typeEntry.code === 'code');
    const valueSet = element.binding?.valueSet?.trim();

    accumulators.set(field, {
      isCode: current.isCode || isCode,
      label: element.label?.trim() || current.label,
      shortDisplay: element.shortDisplay?.trim() || current.shortDisplay,
      short: element.short?.trim() || current.short,
      definition: element.definition?.trim() || current.definition,
      min: typeof element.min === 'number' ? element.min : current.min,
      valueSet: valueSet && valueSet.length > 0 ? valueSet : current.valueSet,
    });
  });

  const definitions: CodeFieldDefinition[] = [];
  const valueSetByField: Record<string, string | undefined> = {};
  const shortDisplayByField: Record<string, string | undefined> = {};

  Array.from(accumulators.entries()).forEach(([field, accumulator]) => {
    if (!accumulator.isCode) {
      return;
    }

    const shortDisplayText = accumulator.shortDisplay ?? accumulator.short;
    const hideShortDisplayInDescription = isPipeDelimitedValueList(shortDisplayText);

    definitions.push({
      field,
      label: toLabel(field, accumulator.label),
      description: hideShortDisplayInDescription
        ? accumulator.definition
        : accumulator.short && accumulator.short !== accumulator.label
          ? accumulator.short
          : accumulator.definition,
      required: (accumulator.min ?? 0) > 0,
    });

    valueSetByField[field] = accumulator.valueSet;
    shortDisplayByField[field] = accumulator.shortDisplay ?? accumulator.short;
  });

  definitions.sort((a, b) => a.label.localeCompare(b.label));

  return { definitions, valueSetByField, shortDisplayByField };
}

export async function getCodeFieldDefinitionsFromSchema(resourceType: string): Promise<CodeFieldDefinition[]> {
  if (!codeFieldDefinitionsPromiseCache.has(resourceType)) {
    codeFieldDefinitionsPromiseCache.set(
      resourceType,
      (async () => {
        const definition = await getStructureDefinition(resourceType);
        const inferred = inferCodeFieldSchema(definition, resourceType);
        codeFieldDefinitionsCache.set(resourceType, inferred.definitions);
        codeFieldValueSetCache.set(resourceType, inferred.valueSetByField);
        codeFieldShortDisplayCache.set(resourceType, inferred.shortDisplayByField);
        return inferred.definitions;
      })()
    );
  }

  return codeFieldDefinitionsPromiseCache.get(resourceType) as Promise<CodeFieldDefinition[]>;
}

function flattenContains(items: ValueSetContains[]): ValueSetContains[] {
  const flattened: ValueSetContains[] = [];

  items.forEach((item) => {
    flattened.push(item);
    if (Array.isArray(item.contains) && item.contains.length > 0) {
      flattened.push(...flattenContains(item.contains));
    }
  });

  return flattened;
}

function dedupeOptions(options: CodeFieldOption[]): CodeFieldOption[] {
  const seen = new Set<string>();

  return options
    .filter((option) => option.value.trim().length > 0)
    .filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }

      seen.add(option.value);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function parsePipeDelimitedShortDisplay(text: string | undefined): CodeFieldOption[] {
  if (!isPipeDelimitedValueList(text)) {
    return [];
  }

  const source = text ?? '';
  const seen = new Set<string>();
  const options: CodeFieldOption[] = [];

  source
    .split('|')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .forEach((value) => {
      if (seen.has(value)) {
        return;
      }

      seen.add(value);
      options.push({ value, label: value });
    });

  return options.length >= 2 ? options : [];
}

function valueSetToOptions(valueSet: ValueSetResource | undefined): CodeFieldOption[] {
  if (!valueSet) {
    return [];
  }

  const expansionContains = flattenContains(valueSet.expansion?.contains ?? [])
    .filter((entry) => typeof entry.code === 'string' && entry.code.trim().length > 0)
    .map((entry) => ({
      value: entry.code!.trim(),
      label: entry.display?.trim() || entry.code!.trim(),
    }));

  if (expansionContains.length > 0) {
    return dedupeOptions(expansionContains);
  }

  const composedConcepts = (valueSet.compose?.include ?? [])
    .flatMap((include) => include.concept ?? [])
    .filter((concept) => typeof concept.code === 'string' && concept.code.trim().length > 0)
    .map((concept) => ({
      value: concept.code!.trim(),
      label: concept.display?.trim() || concept.code!.trim(),
    }));

  return dedupeOptions(composedConcepts);
}

async function expandValueSetFromFhirServer(valueSetUrl: string): Promise<CodeFieldOption[]> {
  const expandUrl = `${normalizeBaseUrl(getBase())}/ValueSet/$expand?url=${encodeURIComponent(valueSetUrl)}`;
  const expanded = await fetchJson<ValueSetResource>(expandUrl);
  return valueSetToOptions(expanded);
}

async function getValueSetBundle(baseUrl: string): Promise<ValueSetBundle | undefined> {
  if (!valueSetBundleCache.has(baseUrl)) {
    valueSetBundleCache.set(baseUrl, fetchJson<ValueSetBundle>(`${baseUrl}/valuesets.json`));
  }

  return valueSetBundleCache.get(baseUrl);
}

function getCanonicalTail(valueSetUrl: string): string | undefined {
  const normalized = valueSetUrl.split('|')[0]?.trim();
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
}

async function readValueSetFromIgBundles(valueSetUrl: string): Promise<CodeFieldOption[]> {
  const bases = getIgTerminologyBases();

  for (const base of bases) {
    const bundle = await getValueSetBundle(base);
    const resource = bundle?.entry?.find((entry) => entry.resource?.url === valueSetUrl)?.resource;
    const options = valueSetToOptions(resource);
    if (options.length > 0) {
      return options;
    }
  }

  const canonicalTail = getCanonicalTail(valueSetUrl);
  if (!canonicalTail) {
    return [];
  }

  const candidates = [
    `ValueSet-${canonicalTail}.json`,
    `valueset-${canonicalTail.toLowerCase()}.json`,
  ];

  for (const base of bases) {
    for (const fileName of candidates) {
      const resource = await fetchJson<ValueSetResource>(`${base}/${fileName}`);
      const options = valueSetToOptions(resource);
      if (options.length > 0) {
        return options;
      }
    }
  }

  return [];
}

export async function getCodeFieldOptions(resourceType: string, field: string): Promise<CodeFieldOption[]> {
  const cacheKey = `${resourceType}.${field}`;
  if (!codeFieldOptionsCache.has(cacheKey)) {
    codeFieldOptionsCache.set(
      cacheKey,
      (async () => {
        await getCodeFieldDefinitionsFromSchema(resourceType);
        const valueSetUrl = codeFieldValueSetCache.get(resourceType)?.[field];
        if (valueSetUrl) {
          const fromExpand = await expandValueSetFromFhirServer(valueSetUrl);
          if (fromExpand.length > 0) {
            return fromExpand;
          }

          const fromIg = await readValueSetFromIgBundles(valueSetUrl);
          if (fromIg.length > 0) {
            return fromIg;
          }
        }

        const shortDisplay = codeFieldShortDisplayCache.get(resourceType)?.[field];
        return parsePipeDelimitedShortDisplay(shortDisplay);
      })()
    );
  }

  return codeFieldOptionsCache.get(cacheKey) as Promise<CodeFieldOption[]>;
}

export function getCodeFieldDefinitions(resourceType?: string): CodeFieldDefinition[] {
  if (!resourceType) {
    return [];
  }

  return codeFieldDefinitionsCache.get(resourceType) ?? [];
}

export function getCodeFieldOverrideValues(resource: Resource): CodeFieldOverrideValues {
  const definitions = getCodeFieldDefinitions(resource.resourceType);
  const next: CodeFieldOverrideValues = {};
  const resourceRecord = resource as unknown as Record<string, unknown>;

  definitions.forEach((definition) => {
    const value = resourceRecord[definition.field];
    next[definition.field] = typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  });

  return next;
}

export function applyCodeFieldOverrides<T extends Resource>(
  resource: T,
  overrides: CodeFieldOverrideValues
): T {
  const definitions = getCodeFieldDefinitions(resource.resourceType);
  if (definitions.length === 0) {
    return resource;
  }

  const next = { ...resource } as Record<string, unknown>;
  definitions.forEach((definition) => {
    const overrideValue = overrides[definition.field];
    if (typeof overrideValue === 'string' && overrideValue.trim().length > 0) {
      next[definition.field] = overrideValue;
    }
  });

  return next as T;
}

export function getOverriddenCodeFieldLabels(resourceType?: string): string[] {
  return getCodeFieldDefinitions(resourceType).map((definition) => definition.label.trim().toLowerCase());
}