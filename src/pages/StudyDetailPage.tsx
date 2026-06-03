import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Anchor, Badge, Button, Center, Grid, Group, Loader,
  Paper, Stack, Table, Tabs, Text, Title,
} from '@mantine/core';
import type { ResearchStudy, ResearchSubject, Specimen } from '@medplum/fhirtypes';
import { CodeableConceptDisplay, ResourceTable } from '@medplum/react';
import { IconArrowLeft } from '@tabler/icons-react';
import { bundleEntries, fhirRead, fhirSearch } from '../fhirClient';

export function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [study, setStudy] = useState<ResearchStudy | null>(null);
  const [subjects, setSubjects] = useState<ResearchSubject[]>([]);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Center py="xl"><Loader size="xl" /></Center>;
  if (error) return <Alert color="red" title="Error">{error}</Alert>;
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
          <Paper p="md" withBorder radius="md">
            <ResourceTable value={study} />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
