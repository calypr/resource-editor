import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Paper, SegmentedControl, Select, Stack, Switch, Text, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ResourceForm } from '@medplum/react';
import type { ResearchStudy, Resource } from '@medplum/fhirtypes';
import { IconArrowLeft } from '@tabler/icons-react';
import { applyEmptyFieldVisibility } from '../formEmptyFieldVisibility';
import { saveLocalResourceDraft } from '../localCrudStore';
import { stripEmptyFields } from '../stripEmptyFields';

const RESOURCE_TYPE_OPTIONS = [
  'ResearchStudy',
  'ResearchSubject',
  'Specimen',
  'Patient',
  'Observation',
  'Condition',
  'Procedure',
  'MedicationRequest',
].map((value) => ({ label: value, value }));

function buildTemplateResource(resourceType: string): Resource {
  const id = crypto.randomUUID();

  if (resourceType === 'ResearchStudy') {
    return {
      resourceType,
      id,
      status: 'active',
      title: 'New Research Study',
    } as ResearchStudy;
  }

  return {
    resourceType,
    id,
  } as Resource;
}

export function CreateResourcePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultType = searchParams.get('resourceType') ?? 'ResearchStudy';
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [draftResource, setDraftResource] = useState<Resource>(buildTemplateResource(defaultType));
  const [jsonValue, setJsonValue] = useState(JSON.stringify(buildTemplateResource(defaultType), null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isSavingJson, setIsSavingJson] = useState(false);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const formContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resourceType = searchParams.get('resourceType') ?? 'ResearchStudy';
    const template = buildTemplateResource(resourceType);
    setDraftResource(template);
    setJsonValue(JSON.stringify(template, null, 2));
    setEditorMode('form');
    setError(null);
  }, [searchParams]);

  useEffect(() => {
    if (editorMode !== 'form' || !formContainerRef.current) {
      return;
    }

    const container = formContainerRef.current;
    const updateVisibility = () => applyEmptyFieldVisibility(container, showEmptyFields);

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
  }, [editorMode, showEmptyFields]);

  async function finalizeSave(resource: Resource): Promise<void> {
    saveLocalResourceDraft(resource, 'created');
    notifications.show({
      color: 'teal',
      message: `${resource.resourceType}/${resource.id} saved locally`,
    });

    navigate(resource.resourceType === 'ResearchStudy' ? `/study/${resource.id}` : `/resource/${resource.resourceType}/${resource.id}`);
  }

  async function handleJsonSave(): Promise<void> {
    try {
      setIsSavingJson(true);
      setError(null);

      const parsed = JSON.parse(jsonValue) as Record<string, unknown>;
      const nextResourceType = String(parsed.resourceType ?? draftResource.resourceType).trim();
      if (!nextResourceType) {
        throw new Error('resourceType is required');
      }

      const nextId = typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : crypto.randomUUID();
      const resource = {
        ...parsed,
        resourceType: nextResourceType,
        id: nextId,
      } as Resource;

      await finalizeSave(resource);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create resource');
    } finally {
      setIsSavingJson(false);
    }
  }

  async function handleFormSubmit(nextResource: Resource): Promise<void> {
    try {
      setError(null);
      const nextResourceType = nextResource.resourceType.trim();
      if (!nextResourceType) {
        throw new Error('resourceType is required');
      }

      const nextId = typeof nextResource.id === 'string' && nextResource.id.trim()
        ? nextResource.id.trim()
        : crypto.randomUUID();

      const normalized = {
        ...nextResource,
        resourceType: nextResourceType,
        id: nextId,
      } as Resource;

      setDraftResource(normalized);
      setJsonValue(JSON.stringify(normalized, null, 2));
      await finalizeSave(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create resource');
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
          <Select
            label="Resource type"
            data={RESOURCE_TYPE_OPTIONS}
            value={draftResource.resourceType}
            onChange={(value) => {
              if (!value || value === draftResource.resourceType) {
                return;
              }

              setSearchParams({ resourceType: value });
            }}
          />

          <SegmentedControl
            value={editorMode}
            onChange={(value) => {
              const nextMode = value as 'form' | 'json';
              setError(null);

              if (nextMode === 'json') {
                setJsonValue(JSON.stringify(draftResource, null, 2));
                setEditorMode(nextMode);
                return;
              }

              try {
                const parsed = JSON.parse(jsonValue) as Resource;
                setDraftResource(parsed);
                setEditorMode(nextMode);
              } catch {
                setError('Cannot switch to form mode until JSON is valid');
              }
            }}
            data={[
              { label: 'Form', value: 'form' },
              { label: 'JSON (advanced)', value: 'json' },
            ]}
          />

          {editorMode === 'form' && (
            <Switch
              label="Show empty fields"
              checked={showEmptyFields}
              onChange={(event) => setShowEmptyFields(event.currentTarget.checked)}
            />
          )}

          {editorMode === 'form' && (
            <Text size="xs" c="dimmed" mt={-4}>
              Hidden fields can be shown again with this toggle.
            </Text>
          )}

          {editorMode === 'form' && (
            <div ref={formContainerRef}>
              <ResourceForm
                key={`${draftResource.resourceType}/${draftResource.id ?? 'new'}/${showEmptyFields ? 'show-empty' : 'hide-empty'}`}
                defaultValue={showEmptyFields ? draftResource : stripEmptyFields(draftResource)}
                onPatch={(next) => {
                  const typed = next as Resource;
                  setDraftResource(typed);
                  setJsonValue(JSON.stringify(typed, null, 2));
                }}
                onSubmit={(next) => {
                  void handleFormSubmit(next);
                }}
              />
            </div>
          )}

          {editorMode === 'json' && (
            <Textarea
              label="FHIR JSON"
              autosize
              minRows={16}
              value={jsonValue}
              onChange={(event) => setJsonValue(event.currentTarget.value)}
              styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
            />
          )}

          {error && (
            <Alert color="red" title="Invalid JSON">
              {error}
            </Alert>
          )}

          {editorMode === 'json' && (
            <Button w="fit-content" loading={isSavingJson} onClick={() => void handleJsonSave()}>
              Save locally
            </Button>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}