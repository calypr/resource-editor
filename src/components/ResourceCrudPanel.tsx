import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, SegmentedControl, Stack, Text, Textarea } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';
import { ResourceForm, ResourceTable } from '@medplum/react';
import type { LocalResourceMode } from '../localCrudStore';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'form' | 'json'>('form');
  const [draftResource, setDraftResource] = useState(resource);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(resource, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftResource(resource);
      setJsonValue(JSON.stringify(resource, null, 2));
    }
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

      if (nextResource.resourceType !== resource.resourceType) {
        throw new Error(`resourceType must remain ${resource.resourceType}`);
      }

      if (nextResource.id !== resource.id) {
        throw new Error(`id must remain ${resource.id}`);
      }

      await onSave(nextResource as T);
      setDraftResource(nextResource as T);
      setJsonValue(JSON.stringify(nextResource, null, 2));
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
              <ResourceTable
                value={resource}
                forceUseInput
              />
            )}

            {isEditing && editMode === 'form' && (
              <ResourceForm
                key={`${resource.resourceType}/${resource.id}`}
                defaultValue={draftResource}
                onPatch={(next) => {
                  const typed = next as T;
                  setDraftResource(typed);
                  setJsonValue(JSON.stringify(typed, null, 2));
                }}
                onSubmit={(next) => {
                  void handleFormSubmit(next);
                }}
              />
            )}

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