import type { Resource } from '@medplum/fhirtypes';
import {
  createLocalStorageCrudProvider,
  type CrudProvider,
  type CrudResourceDraft,
  type CrudResourceMode,
  type CrudState,
} from '../localCrudStore';

export interface CustomBackendCrudProviderOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Plugin template for swapping local CRUD persistence with a custom backend.
 *
 * Replace each TODO block with real API calls to your persistence service.
 * Until then, this provider delegates to local storage so the UI remains usable.
 */
export function createCustomBackendCrudProvider(
  options: CustomBackendCrudProviderOptions
): CrudProvider {
  const fallback = createLocalStorageCrudProvider();
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: 'custom-backend',
    subscribe: fallback.subscribe,
    getState: fallback.getState,
    saveDraft<T extends Resource>(resource: T, mode: CrudResourceMode): CrudResourceDraft<T> {
      // TODO: POST/PUT to `${options.baseUrl}/crud/drafts` with resource and mode.
      // await fetchImpl(`${options.baseUrl}/crud/drafts`, { method: 'POST', ... });
      void fetchImpl;
      return fallback.saveDraft(resource, mode);
    },
    getDraft<T extends Resource>(resourceType: string, id: string): CrudResourceDraft<T> | undefined {
      // TODO: Read-through cache from backend if needed.
      return fallback.getDraft<T>(resourceType, id);
    },
    listDrafts<T extends Resource>(resourceType: string, mode?: CrudResourceMode): CrudResourceDraft<T>[] {
      // TODO: Replace with backend query for draft list.
      return fallback.listDrafts<T>(resourceType, mode);
    },
    isDeleted(resourceType: string, id: string): boolean {
      // TODO: Replace with backend tombstone lookup.
      return fallback.isDeleted(resourceType, id);
    },
    markDeleted(resourceType: string, id: string): void {
      // TODO: Persist deletion tombstone in backend.
      fallback.markDeleted(resourceType, id);
    },
    restoreDeleted(resourceType: string, id: string): void {
      // TODO: Remove deletion tombstone in backend.
      fallback.restoreDeleted(resourceType, id);
    },
  };
}

export function emptyCrudState(): CrudState {
  return {
    drafts: {},
    deleted: {},
  };
}