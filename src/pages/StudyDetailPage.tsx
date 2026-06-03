import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Anchor, Badge, Button, Center, Grid, Group, Loader,
  Paper, Stack, Table, Tabs, Text, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ResearchStudy, ResearchSubject, Specimen } from '@medplum/fhirtypes';
import { CodeableConceptDisplay } from '@medplum/react';
import { IconArrowLeft } from '@tabler/icons-react';
import { RawFhirJson } from '../components/RawFhirJson';
import { ResourceCrudPanel } from '../components/ResourceCrudPanel';
import { bundleEntries, fhirRead, fhirSearch } from '../fhirClient';
import {
  getLocalResourceMode,
  isLocallyDeleted,
  LocallyDeletedResourceError,
  markResourceDeleted,
  restoreDeletedResource,
  saveLocalResourceDraft,
  useLocalCrudState,
} from '../localCrudStore';

export function StudyDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [study, setStudy] = useState<ResearchStudy | null>(null);
  const [subjects, setSubjects] = useState<ResearchSubject[]>([]);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useLocalCrudState();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fhirRead<ResearchStudy>('ResearchStudy', id),
      fhirSearch<ResearchSubject>('ResearchSubject', { study: `ResearchStudy/${id}`, _count: '100' }),
      fhirSearch<Specimen>('Specimen', { _count: '50' }),
    ])
      .then(([s, subBundle, specBundle]) => {
        setStudy(s);
        setSubjects(bundleEntries(subBundle));
        setSpecimens(bundleEntries(specBundle));
      })
      .catch((e: unknown) => {
        if (e instanceof LocallyDeletedResourceError) {
          setStudy(null);
          setSubjects([]);
          setSpecimens([]);
          setError(null);
          return;
        }

        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const localMode = id ? getLocalResourceMode('ResearchStudy', id) : null;
  const deletedLocally = id ? isLocallyDeleted('ResearchStudy', id) : false;

  async function handleSave(nextStudy: ResearchStudy): Promise<void> {
    saveLocalResourceDraft(nextStudy, localMode === 'created' ? 'created' : 'updated');
    setStudy(nextStudy);
    notifications.show({
      color: 'teal',
      message: `ResearchStudy/${nextStudy.id} saved locally`,
    });
  }

  async function handleDelete(): Promise<void> {
    if (!id) {
      return;
    }

    const wasCreatedLocally = localMode === 'created';
    markResourceDeleted('ResearchStudy', id);
    notifications.show({
      color: 'teal',
      message: wasCreatedLocally
        ? `ResearchStudy/${id} removed from local storage`
        : `ResearchStudy/${id} hidden locally`,
    });

    if (wasCreatedLocally) {
      navigate('/');
      return;
    }

    setStudy(null);
    setSubjects([]);
    setSpecimens([]);
  }

  async function handleRestore(): Promise<void> {
    if (!id) {
      return;
    }

    restoreDeletedResource('ResearchStudy', id);
    notifications.show({
      color: 'teal',
      message: `ResearchStudy/${id} restored`,
    });
  }

  if (loading) return <Center py="xl"><Loader size="xl" /></Center>;
  if (error) return <Alert color="red" title="Error">{error}</Alert>;

  if (!study && deletedLocally && id) {
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
          Back to Studies
        </Button>
        <Title order={2}>ResearchStudy / {id}</Title>
        <Alert color="red" title="Deleted locally">
          This study is hidden from the browser until you restore it.
        </Alert>
        <Button w="fit-content" onClick={() => void handleRestore()}>
          Restore study
        </Button>
      </Stack>
    );
  }

  if (!study) return null;

  const title = study.title ?? study.identifier?.[0]?.value ?? `Study ${id}`;

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
        Back to Studies
      </Button>

      <Group align="flex-start" justify="space-between">
        <Stack gap={4} style={{ flex: 1 }}>
          <Title order={2}>{title}</Title>
          {study.identifier?.map((ident, i) => (
            <Text key={i} size="sm" c="dimmed" ff="monospace">{ident.value}</Text>
          ))}
        </Stack>
        <Badge size="lg" color="teal" variant="light">{study.status}</Badge>
      </Group>

      <ResourceCrudPanel
        resource={study}
        localMode={localMode}
        onSave={handleSave}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="subjects">
            Subjects{subjects.length > 0 ? ` (${subjects.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="specimens">
            Specimens{specimens.length > 0 ? ` (${specimens.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="raw">Raw FHIR</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              {study.description && (
                <Paper p="md" withBorder mb="md" radius="md">
                  <Title order={6} mb="xs">Description</Title>
                  <Text size="sm">{study.description}</Text>
                </Paper>
              )}
              {study.focus && study.focus.length > 0 && (
                <Paper p="md" withBorder mb="md" radius="md">
                  <Title order={6} mb="xs">Focus</Title>
                  <Group gap="xs" wrap="wrap">
                    {study.focus.map((f, i) => (
                      <Badge key={i} variant="outline" color="teal">
                        <CodeableConceptDisplay value={f} />
                      </Badge>
                    ))}
                  </Group>
                </Paper>
              )}
              {study.keyword && study.keyword.length > 0 && (
                <Paper p="md" withBorder radius="md">
                  <Title order={6} mb="xs">Keywords</Title>
                  <Group gap="xs" wrap="wrap">
                    {study.keyword.map((kw, i) => (
                      <Badge key={i} variant="light" color="gray">
                        <CodeableConceptDisplay value={kw} />
                      </Badge>
                    ))}
                  </Group>
                </Paper>
              )}
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper p="md" withBorder radius="md">
                <Title order={6} mb="md">Study Metadata</Title>
                <Stack gap="xs">
                  {study.phase && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Phase</Text>
                      <Badge variant="light"><CodeableConceptDisplay value={study.phase} /></Badge>
                    </Group>
                  )}
                  {study.primaryPurposeType && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Purpose</Text>
                      <Text size="sm"><CodeableConceptDisplay value={study.primaryPurposeType} /></Text>
                    </Group>
                  )}
                  {study.category?.map((cat, i) => (
                    <Group key={i} justify="space-between">
                      <Text size="sm" c="dimmed">Category</Text>
                      <Badge variant="dot" size="sm" color="teal">
                        <CodeableConceptDisplay value={cat} />
                      </Badge>
                    </Group>
                  ))}
                  {study.contact?.map((c, i) => (
                    <Group key={i} justify="space-between">
                      <Text size="sm" c="dimmed">Contact</Text>
                      <Text size="sm">{c.name}</Text>
                    </Group>
                  ))}
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">FHIR ID</Text>
                    <Text size="xs" ff="monospace" c="dimmed">{study.id}</Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="subjects" pt="md">
          {subjects.length === 0 ? (
            <Text c="dimmed">No ResearchSubjects linked to this study.</Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Subject ID</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Individual (Patient)</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subjects.map((subj) => (
                  <Table.Tr key={subj.id}>
                    <Table.Td><Text size="sm" ff="monospace">{subj.id}</Text></Table.Td>
                    <Table.Td><Badge size="sm" variant="light">{subj.status}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{subj.individual?.reference ?? '—'}</Text></Table.Td>
                    <Table.Td>
                      <Anchor component={Link} to={`/resource/ResearchSubject/${subj.id}`} size="sm">
                        View FHIR →
                      </Anchor>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="specimens" pt="md">
          {specimens.length === 0 ? (
            <Text c="dimmed">No Specimens returned.</Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {specimens.map((spec) => (
                  <Table.Tr key={spec.id}>
                    <Table.Td><Text size="sm" ff="monospace">{spec.id}</Text></Table.Td>
                    <Table.Td>{spec.type ? <CodeableConceptDisplay value={spec.type} /> : '—'}</Table.Td>
                    <Table.Td><Text size="sm">{spec.subject?.reference ?? '—'}</Text></Table.Td>
                    <Table.Td><Badge size="sm" variant="light">{spec.status ?? 'unknown'}</Badge></Table.Td>
                    <Table.Td>
                      <Anchor component={Link} to={`/resource/Specimen/${spec.id}`} size="sm">
                        View FHIR →
                      </Anchor>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="raw" pt="md">
          <RawFhirJson resource={study} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
