import { useState } from 'react';
import { AppShell, Group, Title, Text, Select, Container, Anchor } from '@mantine/core';
import { IconDna } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { FHIR_SERVERS, getBase, setBase } from '../fhirClient';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [server, setServer] = useState(getBase());

  const handleChange = (val: string | null) => {
    if (!val) return;
    setBase(val);
    setServer(val);
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="xs">
              <IconDna size={26} color="teal" />
              <Anchor component={Link} to="/" underline="never">
                <Title order={4} c="teal">FHIR Aggregator Browser</Title>
              </Anchor>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed" visibleFrom="sm">Server:</Text>
              <Select
                size="xs"
                value={server}
                onChange={handleChange}
                data={Object.entries(FHIR_SERVERS).map(([label, value]) => ({ label, value }))}
                w={220}
              />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
