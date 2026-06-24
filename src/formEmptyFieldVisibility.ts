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

export function applyEmptyFieldVisibility(root: HTMLElement, showEmptyFields: boolean): void {
  const selector = '[class*="mantine-InputWrapper-root"]';
  const sections = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const childrenBySection = new Map<HTMLElement, HTMLElement[]>();

  sections.forEach((section) => {
    childrenBySection.set(section, []);
  });

  sections.forEach((section) => {
    const parent = section.parentElement?.closest<HTMLElement>(selector);
    if (parent && childrenBySection.has(parent)) {
      childrenBySection.get(parent)?.push(section);
    }
  });

  const sectionHasValue = new Map<HTMLElement, boolean>();
  sections
    .slice()
    .sort((a, b) => a.querySelectorAll(selector).length - b.querySelectorAll(selector).length)
    .forEach((section) => {
      const directControls = Array.from(
        section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
      ).filter((control) => control.closest(selector) === section);

      const hasOwnValue = directControls.some((control) => isControlPopulated(control));
      const childSections = childrenBySection.get(section) ?? [];
      const hasPopulatedChildren = childSections.some((child) => sectionHasValue.get(child) === true);
      const hasValue = hasOwnValue || hasPopulatedChildren;
      const visible = showEmptyFields || hasValue;

      sectionHasValue.set(section, hasValue);
      section.style.display = visible ? '' : 'none';
    });
}