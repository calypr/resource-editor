import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Center, Loader, Paper, Stack, Title } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';
import { ResourceTable } from '@medplum/react';
import { IconArrowLeft } from '@tabler/icons-react';
import { fhirRead } from '../fhirClient';

export function ResourceDetailPage() {
  const { resourceType, id } = useParams<{ resourceType: string; id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceType || !id) return;
    setLoading(true);
    fhirRead<Resource>(resourceType, id)
      .then(setResource)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [resourceType, id]);

  if (loading) return <Center py="xl"><Loader size="xl" /></Center>;
  if (error) return <Alert color="red" title="Error">{error}</Alert>;
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
      <Paper p="md" withBorder radius="md">
        <ResourceTable value={resource} />
      </Paper>
    </Stack>
  );
}
