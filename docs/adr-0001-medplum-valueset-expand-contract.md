# ADR 0001: Medplum ValueSet `$expand` Contract for Coded Form Fields

- Status: Accepted
- Date: 2026-06-03
- Deciders: Resource Editor maintainers

## Context

When users edit coded FHIR fields in `@medplum/react` `ResourceForm` (for example, `Specimen.role`), the UI triggers terminology lookups through Medplum's `ValueSetAutocomplete` path.

Observed request pattern:

- `GET /fhir-proxy/ValueSet/$expand?url=<valueset-url>&filter=<user-input>`

Example:

- `GET /fhir-proxy/ValueSet/$expand?url=http%3A%2F%2Fhl7.org%2Ffhir%2FValueSet%2Fspecimen-role&filter=`

From Medplum SDK and React behavior:

- `ValueSetAutocomplete` is the base input for `CodeableConceptInput`, `CodingInput`, and `CodeInput`.
- Those inputs call `medplum.valueSetExpand(...)` using the field binding URL as `url` and typed text as `filter`.
- `MedplumClient.valueSetExpand(...)` constructs a FHIR operation call to `ValueSet/$expand`.

## Decision

The application backend (or proxy target behind `/fhir-proxy`) must be treated as a FHIR terminology service for this workflow, and must support:

1. `GET [base]/ValueSet/$expand`
2. Query parameters at minimum:
   - `url` (required by Medplum usage)
   - `filter` (used for typeahead)
3. Optional parameters for pagination and tuning when needed:
   - `offset`
   - `count`
   - `date`

The response must be a valid FHIR `ValueSet` resource with expansion data in:

- `ValueSet.expansion.contains[]`

Each item should include usable coding fields:

- `system`
- `code`
- `display`

## Consequences

### Positive

- `ResourceForm` coded fields behave as intended (dropdown/typeahead for bound value sets).
- UI does not need local code system bundles for common terminology browsing.
- Behavior aligns with Medplum documented SDK and operation contracts.

### Negative

- If `/ValueSet/$expand` is missing, blocked, or non-conformant, coded fields degrade (empty options/errors).
- Terminology latency affects form responsiveness.
- Access control on terminology endpoints can break form interactions.

### Operational Notes

- In development, Vite proxying is required to avoid browser CORS failures.
- Upstream FHIR servers that are read-only for resources may still need terminology operation support for good UX.
- If upstream terminology is unavailable, provide a pluggable fallback (custom terminology service or cached expansion source).

## Alternatives Considered

1. Local static code lists only
- Rejected: does not scale to all bound value sets and loses dynamic filtering.

2. Custom non-FHIR terminology endpoint
- Rejected for primary path: would require wrapping/adapting Medplum components or replacing them.

3. Continue using ad hoc field-specific workarounds
- Rejected: inconsistent UX and high maintenance.

## References

- Medplum API docs: ValueSet `$expand`
  - https://www.medplum.com/docs/api/fhir/operations/valueset-expand
- Medplum SDK docs: `MedplumClient.valueSetExpand()`
  - https://www.medplum.com/docs/sdk/core.medplumclient.valuesetexpand
- FHIR operation specification
  - https://hl7.org/fhir/R4/valueset-operation-expand.html

### Repository Evidence

- `@medplum/react` `ValueSetAutocomplete` contract in typings.
- `@medplum/core` `valueSetExpand(params)` and `ValueSetExpandParams` signatures.
- `@medplum/core` implementation constructing `ValueSet/$expand` requests.
