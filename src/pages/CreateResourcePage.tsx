import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Paper, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { Resource } from '@medplum/fhirtypes';
import { IconArrowLeft } from '@tabler/icons-react';
import { saveLocalResourceDraft } from '../localCrudStore';

function buildTemplate(resourceType: string): string {
  const id = crypto.randomUUID();

  if (resourceType === 'ResearchStudy') {
    return JSON.stringify(
      {
        resourceType,
        id,
        status: 'active',
        title: 'New Research Study',
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      resourceType,
      id,
    },
    null,
    2
  );
}

export function CreateResourcePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resourceType, setResourceType] = useState(searchParams.get('resourceType') ?? 'ResearchStudy');
  const [jsonValue, setJsonValue] = useState(buildTemplate(searchParams.get('resourceType') ?? 'ResearchStudy'));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setJsonValue(buildTemplate(resourceType || 'ResearchStudy'));
    setError(null);
  }, [resourceType]);

  async function handleSave(): Promise<void> {
    try {
      setIsSaving(true);
      setError(null);

      const parsed = JSON.parse(jsonValue) as Record<string, unknown>;
      const nextResourceType = String(parsed.resourceType ?? resourceType).trim();
      if (!nextResourceType) {
        throw new Error('resourceType is required');
      }

      const nextId = typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : crypto.randomUUID();
      const resource = {
        ...parsed,
        resourceType: nextResourceType,
        id: nextId,
      } as Resource;

      saveLocalResourceDraft(resource, 'created');
      notifications.show({
        color: 'teal',
        message: `${resource.resourceType}/${resource.id} saved locally`,
      });

      navigate(resource.resourceType === 'ResearchStudy' ? `/study/${resource.id}` : `/resource/${resource.resourceType}/${resource.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create resource');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      <Button
        component={Link}
        to="/"
        variant="subtle"
        leftSection={<IconArrowLeft size={15} />}
        size="sm"
        w="fit-content"
      >
        Back
      </Button>

      <Stack gap={4}>
        <Title order={2}>Create Resource</Title>
        <Text c="dimmed" size="sm">
          New resources are stored in local storage and layered on top of the read-only FHIR server.
        </Text>
      </Stack>

      <Paper p="md" withBorder radius="md">
        <Stack gap="md">
          <TextInput
            label="Resource type"
            value={resourceType}
            onChange={(event) => setResourceType(event.currentTarget.value)}
            placeholder="ResearchStudy"
          />

          <Textarea
            label="FHIR JSON"
            autosize
            minRows={16}
            value={jsonValue}
            onChange={(event) => setJsonValue(event.currentTarget.value)}
            styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
          />

          {error && (
            <Alert color="red" title="Invalid JSON">
              {error}
            </Alert>
          )}

          <Button w="fit-content" loading={isSaving} onClick={() => void handleSave()}>
            Save locally
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}