import { Card, Text, Title, Badge, Group, Stack, Button } from '@mantine/core';
import type { ResearchStudy } from '@medplum/fhirtypes';
import { CodeableConceptDisplay } from '@medplum/react';
import { Link } from 'react-router-dom';

interface StudyCardProps {
  study: ResearchStudy;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'teal',
  completed: 'blue',
  'closed-to-accrual': 'orange',
  withdrawn: 'red',
};

function getStudyTitle(study: ResearchStudy): string {
  return study.title ?? study.identifier?.[0]?.value ?? study.id ?? 'Unnamed Study';
}

export function StudyCard({ study }: StudyCardProps) {
  const color = STATUS_COLORS[study.status ?? ''] ?? 'gray';

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder style={{ display: 'flex', flexDirection: 'column' }}>
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Title order={5} lineClamp={2} style={{ flex: 1 }}>
            {getStudyTitle(study)}
          </Title>
          <Badge color={color} variant="light" size="sm" style={{ flexShrink: 0 }}>
            {study.status ?? 'unknown'}
          </Badge>
        </Group>

        {study.identifier?.slice(0, 2).map((id, i) => (
          <Text key={i} size="xs" c="dimmed" ff="monospace" truncate>
            {id.value}
          </Text>
        ))}

        {study.description && (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {study.description}
          </Text>
        )}

        {(study.category ?? study.keyword) && (
          <Group gap={4} wrap="wrap">
            {(study.category ?? []).slice(0, 3).map((cat, i) => (
              <Badge key={`cat-${i}`} variant="dot" size="xs" color="teal">
                <CodeableConceptDisplay value={cat} />
              </Badge>
            ))}
            {(study.keyword ?? []).slice(0, 3).map((kw, i) => (
              <Badge key={`kw-${i}`} variant="outline" size="xs" color="gray">
                <CodeableConceptDisplay value={kw} />
              </Badge>
            ))}
          </Group>
        )}

        <Button
          component={Link}
          to={`/study/${study.id}`}
          variant="light"
          size="xs"
          mt="auto"
          fullWidth
        >
          View Details →
        </Button>
      </Stack>
    </Card>
  );
}
