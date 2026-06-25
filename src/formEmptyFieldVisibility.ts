import type { Resource } from '@medplum/fhirtypes';
import { getOverriddenCodeFieldLabels } from './codeFieldOptions';
import { getBase } from './fhirClient';

const referenceIdentifierCache = new Map<string, Promise<string | undefined>>();
const lastReferenceHintFingerprint = new WeakMap<HTMLElement, string>();

function isControlPopulated(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (control instanceof HTMLInputElement) {
    if (control.type === 'hidden') {
      return control.value.trim().length > 0;
    }

    if (control.type === 'checkbox' || control.type === 'radio') {
      return control.checked;
    }

    return control.value.trim().length > 0;
  }

  if (control instanceof HTMLTextAreaElement) {
    return control.value.trim().length > 0;
  }

  return control.value.trim().length > 0;
}

function getSectionTitle(section: HTMLElement): string {
  const rawTitle = getOwnSectionLabel(section)?.textContent ?? '';
  return rawTitle.replace(/\*/g, '').trim();
}

function getOwnSectionLabel(section: HTMLElement): HTMLElement | null {
  const selector = '[class*="mantine-InputWrapper-root"]';
  const labels = section.querySelectorAll<HTMLElement>('label, [class*="InputWrapper-label"]');
  return Array.from(labels).find((label) => label.closest(selector) === section) ?? null;
}

function toCamelCase(input: string): string {
  const words = input
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '';
  }

  const [first, ...rest] = words;
  return first.toLowerCase() + rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
}

function isRequiredSection(section: HTMLElement): boolean {
  const title = getOwnSectionLabel(section)?.textContent ?? section.textContent ?? '';
  return title.includes('*');
}

function hasDataValue(resource: Record<string, unknown>, key: string): boolean {
  const value = resource[key];

  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function sectionHasBackingData(section: HTMLElement, resource?: unknown): boolean {
  if (!resource || typeof resource !== 'object') {
    return false;
  }

  const typedResource = resource as Record<string, unknown>;

  const title = getSectionTitle(section);
  const key = toCamelCase(title);
  if (!key) {
    return false;
  }

  if (hasDataValue(typedResource, key)) {
    return true;
  }

  return false;
}

function hasPillValue(section: HTMLElement): boolean {
  const pills = section.querySelectorAll<HTMLElement>('[class*="mantine-Pill-root"]');
  return Array.from(pills).some((pill) => (pill.textContent ?? '').trim().length > 0);
}

function hasSearchValue(section: HTMLElement): boolean {
  const searchInputs = section.querySelectorAll<HTMLInputElement>('[role="searchbox"]');
  return Array.from(searchInputs).some((input) => input.value.trim().length > 0);
}

function hasMeaningfulControlValue(
  section: HTMLElement,
  directControls: Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  resource?: unknown
): boolean {
  const required = isRequiredSection(section);
  const dataBacked = sectionHasBackingData(section, resource);
  const nonSelectControls = directControls.filter((control) => !(control instanceof HTMLSelectElement));
  const nonSelectHasValue = nonSelectControls.some((control) => isControlPopulated(control));

  const selectControls = directControls.filter((control): control is HTMLSelectElement => control instanceof HTMLSelectElement);
  const selectHasValue = selectControls.some((control) => control.value.trim().length > 0);

  const relationIdInputs = directControls.filter(
    (control): control is HTMLInputElement =>
      control instanceof HTMLInputElement &&
      control.type === 'text' &&
      control.name.endsWith('-id')
  );
  const relationIdHasValue = relationIdInputs.some((control) => control.value.trim().length > 0);
  const selectIsMeaningful = selectHasValue && (
    relationIdInputs.length === 0
      ? dataBacked || required
      : relationIdHasValue || dataBacked || required
  );

  return nonSelectHasValue || selectIsMeaningful || hasPillValue(section) || hasSearchValue(section) || dataBacked;
}

export function applyEmptyFieldVisibility(
  root: HTMLElement,
  showEmptyFields: boolean,
  resource?: unknown,
  overrideLabels?: string[]
): void {
  const selector = '[class*="mantine-InputWrapper-root"]';
  const sections = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (section) => getOwnSectionLabel(section) !== null
  );
  const sectionSet = new Set(sections);
  const childrenBySection = new Map<HTMLElement, HTMLElement[]>();

  sections.forEach((section) => {
    childrenBySection.set(section, []);
  });

  sections.forEach((section) => {
    let current = section.parentElement?.closest<HTMLElement>(selector) ?? null;
    while (current && !sectionSet.has(current)) {
      current = current.parentElement?.closest<HTMLElement>(selector) ?? null;
    }

    if (current && childrenBySection.has(current)) {
      const parentSection = current;
      if (parentSection !== section) {
        childrenBySection.get(parentSection)?.push(section);
      }
    }
  });

  // Ensure unlabeled internal wrappers are visible so composite editors (e.g. references)
  // remain interactive when hide-empty mode is enabled.
  const unlabeledSections = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (section) => !sectionSet.has(section)
  );
  unlabeledSections.forEach((section) => {
    section.style.display = '';
  });

  const sectionHasValue = new Map<HTMLElement, boolean>();
  const resourceType = (resource as { resourceType?: unknown } | undefined)?.resourceType;
  const hiddenLabels = new Set<string>(
    typeof resourceType === 'string' ? getOverriddenCodeFieldLabels(resourceType) : []
  );
  (overrideLabels ?? []).forEach((label) => {
    const normalized = label.trim().toLowerCase();
    if (normalized.length > 0) {
      hiddenLabels.add(normalized);
    }
  });

  sections
    .slice()
    .sort((a, b) => a.querySelectorAll(selector).length - b.querySelectorAll(selector).length)
    .forEach((section) => {
      const forcedHidden = hiddenLabels.has(getSectionTitle(section).toLowerCase());
      const directControls = Array.from(
        section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
      ).filter((control) => control.closest(selector) === section);

      const hasOwnValue = hasMeaningfulControlValue(section, directControls, resource);
      const childSections = childrenBySection.get(section) ?? [];
      const hasPopulatedChildren = childSections.some((child) => sectionHasValue.get(child) === true);
      const hasValue = hasOwnValue || hasPopulatedChildren;
      const visible = !forcedHidden && (showEmptyFields || hasValue);

      sectionHasValue.set(section, forcedHidden ? true : hasValue);
      section.style.display = visible ? '' : 'none';
    });
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function extractReferenceStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractReferenceStrings(entry));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const reference = (value as { reference?: unknown }).reference;
  if (typeof reference === 'string' && reference.trim().length > 0) {
    return [reference.trim()];
  }

  return [];
}

function parseReference(reference: string): { resourceType: string; id: string } | undefined {
  const [resourceType, id] = reference.split('/');
  if (!resourceType || !id) {
    return undefined;
  }

  return { resourceType, id };
}

function readIdentifier(resource: Resource): string | undefined {
  const identifiers = (resource as { identifier?: Array<{ use?: string; value?: string }> }).identifier ?? [];
  const official = identifiers.find((identifier) => identifier.use === 'official' && identifier.value);
  if (official?.value) {
    return official.value;
  }

  const first = identifiers.find((identifier) => Boolean(identifier.value));
  return first?.value;
}

async function resolveReferenceIdentifier(reference: string): Promise<string | undefined> {
  if (!referenceIdentifierCache.has(reference)) {
    const promise = (async () => {
      const parsed = parseReference(reference);
      if (!parsed) {
        return undefined;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${getBase()}/${parsed.resourceType}/${parsed.id}`, {
          headers: { Accept: 'application/fhir+json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return undefined;
        }

        const resource = await response.json() as Resource;
        return readIdentifier(resource);
      } catch {
        return undefined;
      }
    })();

    referenceIdentifierCache.set(reference, promise);
  }

  return referenceIdentifierCache.get(reference);
}

function setReferenceIdentifierHint(section: HTMLElement, identifiers: string[]): void {
  const existing = section.querySelector<HTMLElement>('[data-reference-identifier-hint="true"]');
  if (identifiers.length === 0) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement('div');
  element.setAttribute('data-reference-identifier-hint', 'true');
  element.style.fontSize = '12px';
  element.style.color = 'var(--mantine-color-dimmed)';
  element.style.marginTop = '4px';

  const label = identifiers.length > 1 ? 'Identifiers' : 'Identifier';
  element.textContent = `${label}: ${identifiers.join(', ')}`;

  if (!existing) {
    section.appendChild(element);
  }
}

function getReferenceFromLink(link: HTMLAnchorElement): string | undefined {
  const text = (link.textContent ?? '').trim();
  if (/^[A-Za-z][A-Za-z0-9]*\/[^\s/]+$/.test(text)) {
    return text;
  }

  const href = link.getAttribute('href') ?? '';
  const match = href.match(/\/([A-Za-z][A-Za-z0-9]*)\/([^/?#]+)/);
  if (!match) {
    return undefined;
  }

  return `${match[1]}/${match[2]}`;
}

function getAppReferenceHref(reference: string): string | undefined {
  const parsed = parseReference(reference);
  if (!parsed) {
    return undefined;
  }

  return `/resource/${parsed.resourceType}/${parsed.id}`;
}

function setReadOnlyReferenceHint(link: HTMLAnchorElement, identifier?: string): void {
  const existing = link.parentElement?.querySelector<HTMLElement>('[data-reference-readonly-hint="true"]');

  if (!identifier) {
    existing?.remove();
    return;
  }

  const hint = existing ?? document.createElement('span');
  hint.setAttribute('data-reference-readonly-hint', 'true');
  hint.style.marginLeft = '6px';
  hint.style.fontSize = '12px';
  hint.style.color = 'var(--mantine-color-dimmed)';
  hint.textContent = `(${identifier})`;

  if (!existing) {
    link.insertAdjacentElement('afterend', hint);
  }
}

export async function ensureReferenceIdentifierHints(root: HTMLElement, resource?: unknown): Promise<void> {
  if (!resource || typeof resource !== 'object') {
    return;
  }

  const typedResource = resource as Record<string, unknown>;
  const selector = '[class*="mantine-InputWrapper-root"]';
  const sections = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (section) => getOwnSectionLabel(section) !== null
  );

  const fingerprint = sections
    .map((section) => {
      const title = getSectionTitle(section);
      const key = toCamelCase(title);
      if (!key) {
        return '';
      }

      const references = extractReferenceStrings(typedResource[key]).sort();
      return `${key}:${references.join('|')}`;
    })
    .filter((entry) => entry.length > 0)
    .join('||');

  if (lastReferenceHintFingerprint.get(root) === fingerprint) {
    return;
  }
  lastReferenceHintFingerprint.set(root, fingerprint);

  await Promise.all(
    sections.map(async (section) => {
      const title = getSectionTitle(section);
      const key = toCamelCase(title);
      if (!key) {
        return;
      }

      const references = extractReferenceStrings(typedResource[key]);
      if (references.length === 0) {
        setReferenceIdentifierHint(section, []);
        return;
      }

      const identifiers = await Promise.allSettled(references.map((reference) => resolveReferenceIdentifier(reference)));
      setReferenceIdentifierHint(
        section,
        identifiers
          .map((result) => (result.status === 'fulfilled' ? result.value : undefined))
          .filter((identifier): identifier is string => Boolean(identifier && identifier.trim().length > 0))
      );
    })
  );
}

export async function ensureReadOnlyReferenceIdentifierHints(root: HTMLElement): Promise<void> {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));
  const referenceLinks = links
    .map((link) => ({ link, reference: getReferenceFromLink(link) }))
    .filter((entry): entry is { link: HTMLAnchorElement; reference: string } => Boolean(entry.reference));

  await Promise.all(
    referenceLinks.map(async ({ link, reference }) => {
      const href = getAppReferenceHref(reference);
      if (href) {
        link.setAttribute('href', href);
      }

      const identifier = await resolveReferenceIdentifier(reference);
      setReadOnlyReferenceHint(link, identifier);
    })
  );
}

function getIgPageUrl(resourceType: string): string {
  const configuredIgBase = import.meta.env.VITE_IG_BASE_URL?.trim();
  const configuredSchemaBase = import.meta.env.VITE_SCHEMA_BASE_URL?.trim();
  const baseUrl = configuredIgBase || configuredSchemaBase || 'https://hl7.org/fhir/R5';
  return `${normalizeBaseUrl(baseUrl)}/${resourceType.toLowerCase()}.html`;
}

export function ensureResourceTypeInfoLink(root: HTMLElement, resourceType: string): void {
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  const targetLabel = labels.find((label) => label.textContent?.trim().toLowerCase() === 'resource type');

  if (!targetLabel || targetLabel.querySelector('[data-resource-type-ig-link="true"]')) {
    return;
  }

  const link = document.createElement('a');
  link.setAttribute('data-resource-type-ig-link', 'true');
  link.href = getIgPageUrl(resourceType);
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.title = `Open ${resourceType} in IG`;
  link.setAttribute('aria-label', `Open ${resourceType} in implementation guide`);
  link.textContent = 'i';
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';
  link.style.justifyContent = 'center';
  link.style.width = '16px';
  link.style.height = '16px';
  link.style.marginLeft = '6px';
  link.style.border = '1px solid currentColor';
  link.style.borderRadius = '999px';
  link.style.fontSize = '11px';
  link.style.fontWeight = '700';
  link.style.lineHeight = '1';
  link.style.textDecoration = 'none';

  targetLabel.appendChild(link);
}