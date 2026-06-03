import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';
import type { LocalResourceMode } from '../localCrudStore';

interface ResourceCrudPanelProps {
  resource: Resource;
  localMode: LocalResourceMode | null;
  onSave: (resource: Resource) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onRestore?: () => Promise<void> | void;
  isDeleted?: boolean;
}

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
  const [jsonValue, setJsonValue] = useState(JSON.stringify(resource, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setJsonValue(JSON.stringify(resource, null, 2));
    }
  }, [isEditing, resource]);

  async function handleSave(): Promise<void> {
    try {
      setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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
          <Textarea
            label="FHIR JSON"
            autosize
            minRows={14}
            value={jsonValue}
            onChange={(event) => setJsonValue(event.currentTarget.value)}
            readOnly={!isEditing}
            styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
          />
        )}

        {error && (
          <Alert color="red" title="Invalid JSON">
            {error}
          </Alert>
        )}

        <Group>
          {!isDeleted && !isEditing && (
            <Button variant="light" onClick={() => setIsEditing(true)}>
              Edit JSON
            </Button>
          )}

          {!isDeleted && isEditing && (
            <Button loading={isSubmitting} onClick={handleSave}>
              Save locally
            </Button>
          )}

          {!isDeleted && isEditing && (
            <Button
              variant="default"
              onClick={() => {
                setError(null);
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