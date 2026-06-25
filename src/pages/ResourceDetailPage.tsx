import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Center, Loader, Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { Resource } from '@medplum/fhirtypes';
import { IconArrowLeft } from '@tabler/icons-react';
import { fhirRead } from '../fhirClient';
import { ResourceCrudPanel } from '../components/ResourceCrudPanel';
import {
  getLocalResourceMode,
  isLocallyDeleted,
  LocallyDeletedResourceError,
  markResourceDeleted,
  restoreDeletedResource,
  saveLocalResourceDraft,
  useLocalCrudState,
} from '../localCrudStore';

export function ResourceDetailPage() {
  const navigate = useNavigate();
  const { resourceType, id } = useParams<{ resourceType: string; id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useLocalCrudState();

  useEffect(() => {
    if (!resourceType || !id) {
      return;
    }

    setLoading(true);
    setError(null);
    fhirRead<Resource>(resourceType, id)
      .then(setResource)
      .catch((e: unknown) => {
        if (e instanceof LocallyDeletedResourceError) {
          setResource(null);
          setError(null);
          return;
        }

        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [resourceType, id]);

  const localMode = resourceType && id ? getLocalResourceMode(resourceType, id) : null;
  const deletedLocally = resourceType && id ? isLocallyDeleted(resourceType, id) : false;

  async function handleSave(nextResource: Resource): Promise<void> {
    const mode = localMode === 'created' ? 'created' : 'updated';
    saveLocalResourceDraft(nextResource, mode);
    setResource(nextResource);
    notifications.show({
      color: 'teal',
      message: `${nextResource.resourceType}/${nextResource.id} saved locally`,
    });
  }

  async function handleDelete(): Promise<void> {
    if (!resourceType || !id) {
      return;
    }

    const wasCreatedLocally = localMode === 'created';
    markResourceDeleted(resourceType, id);
    notifications.show({
      color: 'teal',
      message: wasCreatedLocally
        ? `${resourceType}/${id} removed from local storage`
        : `${resourceType}/${id} hidden locally`,
    });

    if (wasCreatedLocally) {
      navigate('/');
      return;
    }

    setResource(null);
  }

  async function handleRestore(): Promise<void> {
    if (!resourceType || !id) {
      return;
    }

    restoreDeletedResource(resourceType, id);
    notifications.show({
      color: 'teal',
      message: `${resourceType}/${id} restored`,
    });
  }

  if (loading) return <Center py="xl"><Loader size="xl" /></Center>;
  if (error) return <Alert color="red" title="Error">{error}</Alert>;

  if (!resource && deletedLocally && resourceType && id) {
    return (
      <Stack gap="lg">
        <Button
          component={Link}
          to={-1 as unknown as string}
          variant="subtle"
          leftSection={<IconArrowLeft size={15} />}
          size="sm"
          w="fit-content"
        >
          Back
        </Button>
        <Title order={3}>
          {resourceType} / <code style={{ fontSize: '0.8em' }}>{id}</code>
        </Title>
        <Alert color="red" title="Deleted locally">
          This resource is hidden in local storage.
        </Alert>
        <Button w="fit-content" onClick={() => void handleRestore()}>
          Restore resource
        </Button>
      </Stack>
    );
  }

  if (!resource) return null;

  return (
    <Stack gap="lg">
      <Button
        component={Link}
        to={-1 as unknown as string}
        variant="subtle"
        leftSection={<IconArrowLeft size={15} />}
        size="sm"
        w="fit-content"
      >
        Back
      </Button>
      <Title order={3}>
        {resourceType} / <code style={{ fontSize: '0.8em' }}>{id}</code>
      </Title>
      <ResourceCrudPanel
        resource={resource}
        localMode={localMode}
        onSave={handleSave}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />
    </Stack>
  );
}
