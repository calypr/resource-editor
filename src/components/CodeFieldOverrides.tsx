import { useEffect, useState } from 'react';
import { Select, Stack } from '@mantine/core';
import type { Resource } from '@medplum/fhirtypes';
import type { CodeFieldDefinition, CodeFieldOption, CodeFieldOverrideValues } from '../codeFieldOptions';
import { getCodeFieldDefinitionsFromSchema, getCodeFieldOptions } from '../codeFieldOptions';

interface CodeFieldOverridesProps {
  resourceType: string;
  resource: Resource;
  values: CodeFieldOverrideValues;
  showEmptyFields: boolean;
  onChange: (field: string, value: string | undefined) => void;
}

function readCodeValue(resource: Resource, field: string): string | undefined {
  const value = (resource as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function CodeFieldOverrides({ resourceType, resource, values, showEmptyFields, onChange }: CodeFieldOverridesProps) {
  const [definitions, setDefinitions] = useState<CodeFieldDefinition[]>([]);
  const [optionsByField, setOptionsByField] = useState<Record<string, CodeFieldOption[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    setDefinitions([]);
    setOptionsByField({});
    setLoadingFields({});

    void getCodeFieldDefinitionsFromSchema(resourceType).then((resolved) => {
      if (cancelled) {
        return;
      }

      setDefinitions(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [resourceType]);

  useEffect(() => {
    let cancelled = false;

    if (definitions.length === 0) {
      setOptionsByField({});
      setLoadingFields({});
      return () => {
        cancelled = true;
      };
    }

    const nextLoading = Object.fromEntries(definitions.map((definition) => [definition.field, true]));
    setLoadingFields(nextLoading);

    void Promise.all(
      definitions.map(async (definition) => {
        const options = await getCodeFieldOptions(resourceType, definition.field);
        return { field: definition.field, options };
      })
    ).then((resolved) => {
      if (cancelled) {
        return;
      }

      setOptionsByField(Object.fromEntries(resolved.map((entry) => [entry.field, entry.options])));
      setLoadingFields(Object.fromEntries(definitions.map((definition) => [definition.field, false])));
    });

    return () => {
      cancelled = true;
    };
  }, [definitions, resourceType]);

    if (definitions.length === 0) {
    return null;
  }

    const visibleDefinitions = definitions.filter((definition) => {
      if (showEmptyFields) {
        return true;
      }

      const value = values[definition.field] ?? readCodeValue(resource, definition.field);
      return typeof value === 'string' && value.trim().length > 0;
    });

    if (visibleDefinitions.length === 0) {
      return null;
    }

  return (
    <Stack gap="xs">
        {visibleDefinitions.map((definition) => {
          const currentValue = values[definition.field] ?? readCodeValue(resource, definition.field);
        const loadedOptions = optionsByField[definition.field] ?? [];
        const loading = loadingFields[definition.field] ?? false;
        const data = !currentValue || loadedOptions.some((option) => option.value === currentValue)
          ? loadedOptions
          : [...loadedOptions, { value: currentValue, label: currentValue }];

        return (
          <Select
            key={`${resourceType}-${definition.field}`}
            label={definition.label}
              description={definition.description}
            value={currentValue ?? null}
            data={data}
            searchable
            clearable={!definition.required}
            disabled={loading && data.length === 0}
            nothingFoundMessage={loading ? 'Loading codes from IG...' : 'No codes found in IG'}
            onChange={(value) => onChange(definition.field, value ?? undefined)}
          />
        );
        })}
    </Stack>
  );
}