import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, SegmentedControl, Stack, Switch, Text, Textarea } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';
import { ResourceForm, ResourceTable } from '@medplum/react';
import { useNavigate } from 'react-router-dom';
import type { LocalResourceMode } from '../localCrudStore';
import {
  applyCodeFieldOverrides,
  getCodeFieldOverrideValues,
  type CodeFieldOverrideValues,
} from '../codeFieldOptions';
import {
  applyEmptyFieldVisibility,
  ensureReadOnlyReferenceIdentifierHints,
  ensureReferenceIdentifierHints,
  ensureResourceTypeInfoLink,
} from '../formEmptyFieldVisibility';
import { stripEmptyFields } from '../stripEmptyFields';
import { CodeFieldOverrides } from './CodeFieldOverrides';
import { getResourceProfileUrl, ResourceExtensionsSection } from './ResourceExtensionsSection';

function getStatusColor(localMode: LocalResourceMode | null): string {
  if (localMode === 'created') {
    return 'blue';
  }

  if (localMode === 'updated') {
    return 'orange';
  }

  return 'gray';
}

function getStatusLabel(localMode: LocalResourceMode | null): string {
  if (localMode === 'created') {
    return 'Local create';
  }

  if (localMode === 'updated') {
    return 'Local update';
  }

  return 'Server copy';
}

interface TypedResourceCrudPanelProps<T extends Resource> {
  resource: T;
  localMode: LocalResourceMode | null;
  onSave: (resource: T) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onRestore?: () => Promise<void> | void;
  isDeleted?: boolean;
}

export function ResourceCrudPanel<T extends Resource>({
  resource,
  localMode,
  onSave,
  onDelete,
  onRestore,
  isDeleted = false,
}: TypedResourceCrudPanelProps<T>) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'form' | 'json'>('form');
  const [draftResource, setDraftResource] = useState(resource);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(resource, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [codeFieldOverrides, setCodeFieldOverrides] = useState<CodeFieldOverrideValues>(
    () => getCodeFieldOverrideValues(resource)
  );
  const [resolvedCodeFieldLabels, setResolvedCodeFieldLabels] = useState<string[]>([]);
  const formContainerRef = useRef<HTMLDivElement | null>(null);
  const readOnlyContainerRef = useRef<HTMLDivElement | null>(null);
  const profileUrl = getResourceProfileUrl(resource);

  useEffect(() => {
    if (!isEditing) {
      setDraftResource(resource);
      setJsonValue(JSON.stringify(resource, null, 2));
      setCodeFieldOverrides(getCodeFieldOverrideValues(resource));
    }
  }, [isEditing, resource]);

  useEffect(() => {
    if (!isEditing || editMode !== 'form' || !formContainerRef.current) {
      return;
    }

    const container = formContainerRef.current;
    const updateVisibility = () => {
      applyEmptyFieldVisibility(container, showEmptyFields, draftResource, resolvedCodeFieldLabels);
      ensureResourceTypeInfoLink(container, resource.resourceType);
      void ensureReferenceIdentifierHints(container, draftResource);
    };

    updateVisibility();

    const mutationObserver = new MutationObserver(() => updateVisibility());
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'checked', 'class'],
    });

    const inputHandler = () => updateVisibility();
    container.addEventListener('input', inputHandler, true);
    container.addEventListener('change', inputHandler, true);

    return () => {
      mutationObserver.disconnect();
      container.removeEventListener('input', inputHandler, true);
      container.removeEventListener('change', inputHandler, true);
    };
  }, [draftResource, editMode, isEditing, resource.resourceType, showEmptyFields, resolvedCodeFieldLabels]);

  useEffect(() => {
    if (isEditing || !readOnlyContainerRef.current) {
      return;
    }

    const container = readOnlyContainerRef.current;
    void ensureReadOnlyReferenceIdentifierHints(container);
  }, [isEditing, resource]);

  useEffect(() => {
    if (isEditing || !readOnlyContainerRef.current) {
      return;
    }

    const container = readOnlyContainerRef.current;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a');
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('/resource/') && !href.startsWith('/study/')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void navigate(href);
    };

    container.addEventListener('click', handleClick, true);

    return () => {
      container.removeEventListener('click', handleClick, true);
    };
  }, [isEditing, resource]);

  async function handleJsonSave(): Promise<void> {
    try {
      setError(null);

      const parsed = JSON.parse(jsonValue) as Record<string, unknown>;
      if (parsed.resourceType !== resource.resourceType) {
        throw new Error(`resourceType must remain ${resource.resourceType}`);
      }

      if (parsed.id !== resource.id) {
        throw new Error(`id must remain ${resource.id}`);
      }

      await onSave(parsed as T);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save resource');
    }
  }

  async function handleFormSubmit(nextResource: Resource): Promise<void> {
    try {
      setError(null);
      const mergedResource = applyCodeFieldOverrides(nextResource as T, codeFieldOverrides);

      if (mergedResource.resourceType !== resource.resourceType) {
        throw new Error(`resourceType must remain ${resource.resourceType}`);
      }

      if (mergedResource.id !== resource.id) {
        throw new Error(`id must remain ${resource.id}`);
      }

      await onSave(mergedResource);
      setDraftResource(mergedResource);
      setJsonValue(JSON.stringify(mergedResource, null, 2));
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save resource');
    }
  }

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={600}>Local CRUD</Text>
            <Text size="sm" c="dimmed">
              Updates and deletes are stored in this browser because the upstream FHIR server is read only.
            </Text>
          </Stack>
          <Badge color={getStatusColor(localMode)} variant="light">
            {getStatusLabel(localMode)}
          </Badge>
        </Group>

        {isDeleted ? (
          <Alert color="red" title="Deleted locally">
            This resource is hidden locally. Restore it to resume browsing the server copy.
          </Alert>
        ) : (
          <>
            {isEditing && (
              <SegmentedControl
                value={editMode}
                onChange={(value) => {
                  const nextMode = value as 'form' | 'json';
                  setError(null);

                  if (nextMode === 'json') {
                    setJsonValue(JSON.stringify(draftResource, null, 2));
                    setEditMode(nextMode);
                    return;
                  }

                  try {
                    const parsed = JSON.parse(jsonValue) as T;
                    setDraftResource(parsed);
                    setEditMode(nextMode);
                  } catch {
                    setError('Cannot switch to form mode until JSON is valid');
                  }
                }}
                data={[
                  { label: 'Form', value: 'form' },
                  { label: 'JSON', value: 'json' },
                ]}
              />
            )}

            {!isEditing && (
              <Switch
                label="Show empty fields"
                checked={showEmptyFields}
                onChange={(event) => setShowEmptyFields(event.currentTarget.checked)}
              />
            )}

            {!isEditing && (
              <div ref={readOnlyContainerRef}>
                <ResourceTable
                  value={showEmptyFields ? resource : stripEmptyFields(resource)}
                  ignoreMissingValues={!showEmptyFields}
                  forceUseInput
                  profileUrl={profileUrl}
                />
              </div>
            )}

            {!isEditing && !profileUrl && <ResourceExtensionsSection resource={resource} />}

            {isEditing && editMode === 'form' && (
              <Stack gap="xs">
                  <CodeFieldOverrides
                    resourceType={draftResource.resourceType}
                    resource={draftResource}
                    values={codeFieldOverrides}
                    showEmptyFields={showEmptyFields}
                    onVisibleFieldLabelsChange={setResolvedCodeFieldLabels}
                    onChange={(field, value) => {
                      setCodeFieldOverrides((previous) => {
                        const nextOverrides = { ...previous, [field]: value };
                        const nextDraft = applyCodeFieldOverrides(draftResource, nextOverrides);
                        setDraftResource(nextDraft);
                        setJsonValue(JSON.stringify(nextDraft, null, 2));
                        return nextOverrides;
                      });
                    }}
                  />
                <Switch
                  label="Show empty fields"
                  checked={showEmptyFields}
                  onChange={(event) => setShowEmptyFields(event.currentTarget.checked)}
                />
                <Text size="xs" c="dimmed" mt={-4}>
                  Hidden fields can be shown again with this toggle.
                </Text>
                <div ref={formContainerRef}>
                  <ResourceForm
                    key={`${resource.resourceType}/${resource.id}/${showEmptyFields ? 'show-empty' : 'hide-empty'}`}
                    defaultValue={showEmptyFields ? draftResource : stripEmptyFields(draftResource)}
                    profileUrl={profileUrl}
                    onPatch={(next) => {
                      const typed = applyCodeFieldOverrides(next as T, codeFieldOverrides);
                      setDraftResource(typed);
                      setJsonValue(JSON.stringify(typed, null, 2));
                    }}
                    onSubmit={(next) => {
                      void handleFormSubmit(next);
                    }}
                  />
                </div>
              </Stack>
            )}

            {isEditing && editMode === 'form' && !profileUrl && <ResourceExtensionsSection resource={draftResource} />}

            {isEditing && editMode === 'json' && (
              <Textarea
                label="FHIR JSON"
                autosize
                minRows={14}
                value={jsonValue}
                onChange={(event) => setJsonValue(event.currentTarget.value)}
                styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
              />
            )}
          </>
        )}

        {error && (
          <Alert color="red" title="Invalid JSON">
            {error}
          </Alert>
        )}

        <Group>
          {!isDeleted && !isEditing && (
            <Button
              variant="light"
              onClick={() => {
                setError(null);
                setEditMode('form');
                setDraftResource(resource);
                setJsonValue(JSON.stringify(resource, null, 2));
                setCodeFieldOverrides(getCodeFieldOverrideValues(resource));
                setResolvedCodeFieldLabels([]);
                setIsEditing(true);
              }}
            >
              Edit form
            </Button>
          )}

          {!isDeleted && !isEditing && (
            <Button
              variant="default"
              onClick={() => {
                setError(null);
                setEditMode('json');
                setDraftResource(resource);
                setJsonValue(JSON.stringify(resource, null, 2));
                setCodeFieldOverrides(getCodeFieldOverrideValues(resource));
                setResolvedCodeFieldLabels([]);
                setIsEditing(true);
              }}
            >
              Edit JSON
            </Button>
          )}

          {!isDeleted && isEditing && editMode === 'json' && (
            <Button onClick={() => void handleJsonSave()}>
              Save locally
            </Button>
          )}

          {!isDeleted && isEditing && (
            <Button
              variant="default"
              onClick={() => {
                setError(null);
                setDraftResource(resource);
                setJsonValue(JSON.stringify(resource, null, 2));
                setCodeFieldOverrides(getCodeFieldOverrideValues(resource));
                setResolvedCodeFieldLabels([]);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          )}

          {!isDeleted && (
            <Button color="red" variant="light" onClick={() => void onDelete()}>
              Delete locally
            </Button>
          )}

          {isDeleted && onRestore && (
            <Button onClick={() => void onRestore()}>
              Restore
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}