import type { Resource } from '@medplum/fhirtypes';

export interface CodeFieldOption {
  value: string;
  label: string;
}

export interface CodeFieldDefinition {
  field: string;
  label: string;
  required?: boolean;
  options: CodeFieldOption[];
}

export type CodeFieldOverrideValues = Record<string, string | undefined>;

const RESEARCH_STUDY_STATUS_OPTIONS: CodeFieldOption[] = [
  { value: 'active', label: 'active' },
  { value: 'administratively-completed', label: 'administratively-completed' },
  { value: 'approved', label: 'approved' },
  { value: 'closed-to-accrual', label: 'closed-to-accrual' },
  { value: 'closed-to-accrual-and-intervention', label: 'closed-to-accrual-and-intervention' },
  { value: 'completed', label: 'completed' },
  { value: 'disapproved', label: 'disapproved' },
  { value: 'in-review', label: 'in-review' },
  { value: 'temporarily-closed-to-accrual', label: 'temporarily-closed-to-accrual' },
  { value: 'temporarily-closed-to-accrual-and-intervention', label: 'temporarily-closed-to-accrual-and-intervention' },
  { value: 'withdrawn', label: 'withdrawn' },
];

const CODE_FIELD_DEFINITIONS: Record<string, CodeFieldDefinition[]> = {
  ResearchStudy: [
    {
      field: 'status',
      label: 'Status',
      required: true,
      options: RESEARCH_STUDY_STATUS_OPTIONS,
    },
  ],
};

export function getCodeFieldDefinitions(resourceType?: string): CodeFieldDefinition[] {
  if (!resourceType) {
    return [];
  }

  return CODE_FIELD_DEFINITIONS[resourceType] ?? [];
}

export function getCodeFieldOverrideValues(resource: Resource): CodeFieldOverrideValues {
  const definitions = getCodeFieldDefinitions(resource.resourceType);
  const next: CodeFieldOverrideValues = {};
  const resourceRecord = resource as unknown as Record<string, unknown>;

  definitions.forEach((definition) => {
    const value = resourceRecord[definition.field];
    next[definition.field] = typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  });

  return next;
}

export function applyCodeFieldOverrides<T extends Resource>(
  resource: T,
  overrides: CodeFieldOverrideValues
): T {
  const definitions = getCodeFieldDefinitions(resource.resourceType);
  if (definitions.length === 0) {
    return resource;
  }

  const next = { ...resource } as Record<string, unknown>;
  definitions.forEach((definition) => {
    const overrideValue = overrides[definition.field];
    if (overrideValue && overrideValue.trim().length > 0) {
      next[definition.field] = overrideValue;
    } else {
      delete next[definition.field];
    }
  });

  return next as T;
}

export function getOverriddenCodeFieldLabels(resourceType?: string): string[] {
  return getCodeFieldDefinitions(resourceType).map((definition) => definition.label.trim().toLowerCase());
}