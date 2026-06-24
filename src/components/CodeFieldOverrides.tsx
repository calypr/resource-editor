import { Select, Stack } from '@mantine/core';
import type { CodeFieldOverrideValues } from '../codeFieldOptions';
import { getCodeFieldDefinitions } from '../codeFieldOptions';

interface CodeFieldOverridesProps {
  resourceType: string;
  values: CodeFieldOverrideValues;
  onChange: (field: string, value: string | undefined) => void;
}

export function CodeFieldOverrides({ resourceType, values, onChange }: CodeFieldOverridesProps) {
  const definitions = getCodeFieldDefinitions(resourceType);
  if (definitions.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      {definitions.map((definition) => (
        <Select
          key={`${resourceType}-${definition.field}`}
          label={definition.label}
          value={values[definition.field] ?? null}
          data={definition.options}
          searchable
          clearable={!definition.required}
          onChange={(value) => onChange(definition.field, value ?? undefined)}
        />
      ))}
    </Stack>
  );
}