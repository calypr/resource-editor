import { Paper } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';

interface RawFhirJsonProps {
  resource: Resource;
}

export function RawFhirJson({ resource }: RawFhirJsonProps) {
  return (
    <Paper p="md" withBorder radius="md">
      <pre
        style={{
          margin: 0,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}
      >
        {JSON.stringify(resource, null, 2)}
      </pre>
    </Paper>
  );
}