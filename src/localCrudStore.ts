import { useSyncExternalStore } from 'react';
import type { Resource } from '@medplum/fhirtypes';

const STORAGE_KEY = 'resource-editor.local-crud.v1';
const STORE_EVENT = 'resource-editor:local-crud-change';

export type CrudResourceMode = 'created' | 'updated';

export interface CrudResourceDraft<T extends Resource = Resource> {
  resource: T;
  mode: CrudResourceMode;
  updatedAt: string;
}

export interface CrudState {
  drafts: Record<string, CrudResourceDraft>;
  deleted: Record<string, string>;
}

export interface CrudProvider {
  readonly name: string;
  subscribe(listener: () => void): () => void;
  getState(): CrudState;
  saveDraft<T extends Resource>(resource: T, mode: CrudResourceMode): CrudResourceDraft<T>;
  getDraft<T extends Resource>(resourceType: string, id: string): CrudResourceDraft<T> | undefined;
  listDrafts<T extends Resource>(resourceType: string, mode?: CrudResourceMode): CrudResourceDraft<T>[];
  isDeleted(resourceType: string, id: string): boolean;
  markDeleted(resourceType: string, id: string): void;
  restoreDeleted(resourceType: string, id: string): void;
}

const EMPTY_STATE: CrudState = {
  drafts: {},
  deleted: {},
};

let cachedRawState: string | null = null;
let cachedParsedState: CrudState = EMPTY_STATE;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function resourceKey(resourceType: string, id: string): string {
  return `${resourceType}/${id}`;
}

function readState(): CrudState {
  if (!canUseStorage()) {
    return EMPTY_STATE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRawState) {
    return cachedParsedState;
  }

  if (!raw) {
    cachedRawState = null;
    cachedParsedState = EMPTY_STATE;
    return EMPTY_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CrudState>;
    const nextState = {
      drafts: parsed.drafts ?? {},
      deleted: parsed.deleted ?? {},
    };

    cachedRawState = raw;
    cachedParsedState = nextState;
    return nextState;
  } catch {
    cachedRawState = null;
    cachedParsedState = EMPTY_STATE;
    return EMPTY_STATE;
  }
}

function writeState(state: CrudState): void {
  if (!canUseStorage()) {
    return;
  }

  const serialized = JSON.stringify(state);
  cachedRawState = serialized;
  cachedParsedState = state;

  window.localStorage.setItem(STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(STORE_EVENT));
}

function subscribe(listener: () => void): () => void {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleChange = () => listener();
  window.addEventListener(STORE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(STORE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

function assertResourceIdentity(resource: Resource): asserts resource is Resource & { id: string } {
  if (!resource.resourceType) {
    throw new Error('FHIR resource must include a resourceType');
  }

  if (!resource.id) {
    throw new Error('FHIR resource must include an id');
  }
}

function createResourceKey(resourceType: string, id: string): string {
  return resourceKey(resourceType, id);
}

export function createLocalStorageCrudProvider(): CrudProvider {
  return {
    name: 'localStorage',
    subscribe,
    getState: readState,
    saveDraft<T extends Resource>(resource: T, mode: CrudResourceMode): CrudResourceDraft<T> {
      assertResourceIdentity(resource);

      const state = readState();
      const key = createResourceKey(resource.resourceType, resource.id);
      const draft: CrudResourceDraft<T> = {
        resource,
        mode,
        updatedAt: new Date().toISOString(),
      };

      writeState({
        drafts: {
          ...state.drafts,
          [key]: draft,
        },
        deleted: Object.fromEntries(
          Object.entries(state.deleted).filter(([deletedKey]) => deletedKey !== key)
        ),
      });

      return draft;
    },
    getDraft<T extends Resource>(resourceType: string, id: string): CrudResourceDraft<T> | undefined {
      return readState().drafts[createResourceKey(resourceType, id)] as CrudResourceDraft<T> | undefined;
    },
    listDrafts<T extends Resource>(resourceType: string, mode?: CrudResourceMode): CrudResourceDraft<T>[] {
      return Object.values(readState().drafts)
        .filter((draft) => draft.resource.resourceType === resourceType)
        .filter((draft) => (mode ? draft.mode === mode : true)) as CrudResourceDraft<T>[];
    },
    isDeleted(resourceType: string, id: string): boolean {
      return Boolean(readState().deleted[createResourceKey(resourceType, id)]);
    },
    markDeleted(resourceType: string, id: string): void {
      const state = readState();
      const key = createResourceKey(resourceType, id);
      const existingDraft = state.drafts[key];
      const nextDrafts = Object.fromEntries(
        Object.entries(state.drafts).filter(([draftKey]) => draftKey !== key)
      );

      if (existingDraft?.mode === 'created') {
        writeState({ drafts: nextDrafts, deleted: state.deleted });
        return;
      }

      writeState({
        drafts: nextDrafts,
        deleted: {
          ...state.deleted,
          [key]: new Date().toISOString(),
        },
      });
    },
    restoreDeleted(resourceType: string, id: string): void {
      const state = readState();
      const key = createResourceKey(resourceType, id);
      writeState({
        drafts: state.drafts,
        deleted: Object.fromEntries(
          Object.entries(state.deleted).filter(([deletedKey]) => deletedKey !== key)
        ),
      });
    },
  };
}

let activeCrudProvider: CrudProvider = createLocalStorageCrudProvider();

export function setCrudProvider(provider: CrudProvider): void {
  activeCrudProvider = provider;
}

export function getCrudProvider(): CrudProvider {
  return activeCrudProvider;
}

export function useCrudState(): CrudState {
  const provider = getCrudProvider();
  return useSyncExternalStore(provider.subscribe, provider.getState, () => EMPTY_STATE);
}

export function getLocalResourceDraft<T extends Resource>(
  resourceType: string,
  id: string
): CrudResourceDraft<T> | undefined {
  return getCrudProvider().getDraft(resourceType, id);
}

export function listLocalResourceDrafts<T extends Resource>(
  resourceType: string,
  mode?: CrudResourceMode
): CrudResourceDraft<T>[] {
  return getCrudProvider().listDrafts(resourceType, mode);
}

export function saveLocalResourceDraft<T extends Resource>(
  resource: T,
  mode: CrudResourceMode
): CrudResourceDraft<T> {
  return getCrudProvider().saveDraft(resource, mode);
}

export function isLocallyDeleted(resourceType: string, id: string): boolean {
  return getCrudProvider().isDeleted(resourceType, id);
}

export function markResourceDeleted(resourceType: string, id: string): void {
  getCrudProvider().markDeleted(resourceType, id);
}

export function restoreDeletedResource(resourceType: string, id: string): void {
  getCrudProvider().restoreDeleted(resourceType, id);
}

export function getLocalResourceMode(resourceType: string, id: string): CrudResourceMode | null {
  return getLocalResourceDraft(resourceType, id)?.mode ?? null;
}

export function applyLocalResourceOverlay<T extends Resource>(resource: T): T | null {
  if (!resource.id) {
    return resource;
  }

  const key = resourceKey(resource.resourceType, resource.id);
  const state = getCrudProvider().getState();

  if (state.deleted[key]) {
    return null;
  }

  const draft = state.drafts[key] as CrudResourceDraft<T> | undefined;
  return draft?.resource ?? resource;
}

export function applyLocalResourceListOverlay<T extends Resource>(resources: T[]): T[] {
  return resources
    .map((resource) => applyLocalResourceOverlay(resource))
    .filter((resource): resource is T => Boolean(resource));
}

export class LocallyDeletedResourceError extends Error {
  constructor(resourceType: string, id: string) {
    super(`${resourceType}/${id} has been deleted locally`);
    this.name = 'LocallyDeletedResourceError';
  }
}

export function useLocalCrudState(): CrudState {
  return useCrudState();
}

export type LocalResourceMode = CrudResourceMode;
export type LocalResourceDraft<T extends Resource = Resource> = CrudResourceDraft<T>;