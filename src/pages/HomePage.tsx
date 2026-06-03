import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon, Alert, Badge, Button, Center, Group,
  Loader, Pagination, SimpleGrid, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import type { ResearchStudy } from '@medplum/fhirtypes';
import { fhirSearch, bundleEntries } from '../fhirClient';
import { StudyCard } from '../components/StudyCard';
import { listLocalResourceDrafts, type LocalResourceMode, useLocalCrudState } from '../localCrudStore';

const PAGE_SIZE = 12;

const QUICK_PICKS = [
  'TCGA-BRCA', 'TCGA-LUAD', 'TCGA-GBM', 'TCGA-OV',
  'TCGA-UCEC', 'TCGA-KIRC', 'TCGA-HNSC', 'TCGA-LGG',
  'TCGA-THCA', 'TCGA-PRAD', 'TCGA-COAD', 'TCGA-STAD',
];

export function HomePage() {
  const [query, setQuery] = useState('');
  const [serverStudies, setServerStudies] = useState<ResearchStudy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crudState = useLocalCrudState();

  const localDrafts = useMemo(() => listLocalResourceDrafts<ResearchStudy>('ResearchStudy'), [crudState]);
  const localModes = useMemo(
    () => new Map<string, LocalResourceMode>(localDrafts.map((draft) => [draft.resource.id ?? '', draft.mode])),
    [localDrafts]
  );

  const studies = useMemo(() => {
    const createdStudies = localDrafts
      .filter((draft) => draft.mode === 'created')
      .map((draft) => draft.resource)
      .filter((study) => {
        if (!query.trim()) {
          return true;
        }

        const haystack = [
          study.id,
          study.title,
          ...(study.identifier ?? []).map((identifier) => identifier.value),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query.trim().toLowerCase());
      });

    const createdIds = new Set(createdStudies.map((study) => study.id));
    return [...createdStudies, ...serverStudies.filter((study) => !createdIds.has(study.id))];
  }, [localDrafts, query, serverStudies]);

  const search = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        _count: String(PAGE_SIZE),
        _offset: String((p - 1) * PAGE_SIZE),
        _sort: '-_lastUpdated',
      };
      if (q.trim()) params['identifier'] = q.trim();

      const bundle = await fhirSearch<ResearchStudy>('ResearchStudy', params);
      setServerStudies(bundleEntries(bundle));
      setTotal(bundle.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch studies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search('', 1); }, [search]);

  const handleSearch = () => { setPage(1); search(query, 1); };
  const handlePageChange = (p: number) => { setPage(p); search(query, p); };
  const handleQuickPick = (id: string) => { setQuery(id); setPage(1); search(id, 1); };
  const handleReset = () => { setQuery(''); setPage(1); search('', 1); };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Research Studies</Title>
        <Text c="dimmed" size="sm">
          Browse biomedical research datasets from{' '}
          <Text component="a" href="https://fhir-aggregator.org" target="_blank" c="teal" inherit>
            fhir-aggregator.org
          </Text>
          {' '}— TCGA, GDC, HTAN, ICGC, GTEx, and more.
        </Text>
      </Stack>

      <Group gap="sm">
        <TextInput
          placeholder="Search by identifier (e.g. TCGA-BRCA)…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          leftSection={<IconSearch size={15} />}
          style={{ flex: 1 }}
        />
        <Button onClick={handleSearch} loading={loading} leftSection={<IconSearch size={15} />}>
          Search
        </Button>
        <Button component={Link} to="/resource/new?resourceType=ResearchStudy" variant="light">
          New Study
        </Button>
        <ActionIcon variant="light" size="lg" title="Reset" onClick={handleReset}>
          <IconRefresh size={15} />
        </ActionIcon>
      </Group>

      <Group gap={6} wrap="wrap">
        <Text size="xs" c="dimmed" fw={600}>Quick pick:</Text>
        {QUICK_PICKS.map((id) => (
          <Badge
            key={id}
            variant={query === id ? 'filled' : 'outline'}
            color="teal"
            size="sm"
            style={{ cursor: 'pointer' }}
            onClick={() => handleQuickPick(id)}
          >
            {id}
          </Badge>
        ))}
      </Group>

      {loading && <Center py="xl"><Loader size="lg" /></Center>}

      {error && (
        <Alert color="red" title="Request failed">
          {error}
          <Text size="xs" c="dimmed" mt={4}>
            Tip: run <code>npm run dev</code> — the Vite dev proxy avoids CORS issues.
          </Text>
        </Alert>
      )}

      {!loading && !error && studies.length === 0 && (
        <Center py="xl">
          <Text c="dimmed">No studies found. Try a different identifier.</Text>
        </Center>
      )}

      {!loading && studies.length > 0 && (
        <>
          <Text size="xs" c="dimmed">
            Showing {studies.length.toLocaleString()} studies on this page
            {total > 0 ? ` (${total.toLocaleString()} reported by server)` : ''}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {studies.map((study) => (
              <StudyCard key={study.id} study={study} localMode={study.id ? localModes.get(study.id) ?? null : null} />
            ))}
          </SimpleGrid>
          {total > PAGE_SIZE && (
            <Center mt="md">
              <Pagination
                value={page}
                onChange={handlePageChange}
                total={Math.ceil(total / PAGE_SIZE)}
              />
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}
