import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { Extension, Resource } from '@medplum/fhirtypes';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function formatValue(value: JsonLike): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(', ');
  }

  if (value && typeof value === 'object') {
    if ('reference' in value && typeof value.reference === 'string') {
      return value.reference;
    }

    if ('display' in value && typeof value.display === 'string') {
      return value.display;
    }

    if ('system' in value && 'value' in value && typeof value.system === 'string' && typeof value.value === 'string') {
      return `${value.system}: ${value.value}`;
    }

    return JSON.stringify(value);
  }

  return '';
}

function formatExtensionLabel(extension: Extension): string {
  const url = extension.url.trim() || 'Extension';

  if (extension.valueCode) {
    return `${url}: ${extension.valueCode}`;
  }

  if (extension.valueString) {
    return `${url}: ${extension.valueString}`;
  }

  if (typeof extension.valueBoolean === 'boolean') {
    return `${url}: ${extension.valueBoolean}`;
  }

  if (typeof extension.valueInteger === 'number') {
    return `${url}: ${extension.valueInteger}`;
  }

  if (extension.valueReference) {
    return `${url}: ${formatValue(extension.valueReference as JsonLike)}`;
  }

  return url;
}

function getNestedExtensions(extension: Extension): Extension[] {
  const nested = extension.extension;
  if (!Array.isArray(nested)) {
    return [];
  }

  return nested;
}

function ExtensionRow({ extension, depth }: { extension: Extension; depth: number }) {
  const nested = getNestedExtensions(extension);

  return (
    <Stack gap={6} style={{ paddingLeft: depth > 0 ? depth * 16 : 0 }}>
      <Group gap={8} wrap="nowrap" align="flex-start">
        <Badge variant="light" color="teal" size="sm" style={{ marginTop: 1, flexShrink: 0 }}>
          extension
        </Badge>
        <Text size="sm" style={{ wordBreak: 'break-word' }}>
          {formatExtensionLabel(extension)}
        </Text>
      </Group>

      {nested.length > 0 && (
        <Stack gap={6} style={{ borderLeft: '1px solid var(--mantine-color-gray-3)', marginLeft: 9, paddingLeft: 12 }}>
          {nested.map((child, index) => (
            <ExtensionRow key={`${String(child.url ?? 'nested')}-${index}`} extension={child} depth={depth + 1} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

interface ResourceExtensionsSectionProps {
  resource: Resource;
}

export function getResourceProfileUrl(resource: Resource): string | undefined {
  const profile = resource.meta?.profile?.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return profile?.trim();
}

export function ResourceExtensionsSection({ resource }: ResourceExtensionsSectionProps) {
  const extensions = 'extension' in resource ? resource.extension : undefined;

  if (!Array.isArray(extensions) || extensions.length === 0) {
    return null;
  }

  const visibleExtensions = extensions;

  if (visibleExtensions.length === 0) {
    return null;
  }

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="sm">
        <Title order={5}>Extensions</Title>
        <Text size="sm" c="dimmed">
          This resource has extensions, but no profile was available to render them with schema-aware controls.
        </Text>
        <Stack gap="md">
          {visibleExtensions.map((extension, index) => (
            <ExtensionRow key={`${extension.url}-${index}`} extension={extension} depth={0} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}