# ADR 0002: Application Architecture, Dependency Strategy, and POC Fit

- Status: Accepted
- Date: 2026-06-03
- Deciders: Resource Editor maintainers

## Context

This repository is a browser-first FHIR resource explorer/editor for read-only upstream data sources (currently Google FHIR Aggregator). The app needs to:

1. Browse and inspect study-centric datasets quickly.
2. Support form-based and raw JSON editing for resources.
3. Demonstrate CRUD-like workflows even when the upstream server is read-only.
4. Minimize backend infrastructure for rapid iteration.

The project currently uses a React SPA architecture with Medplum components and a local CRUD overlay.

## Decision

Adopt a thin-client architecture with these characteristics:

1. A single-page React app as the primary runtime.
2. Medplum SDK/components for FHIR form rendering, tables, and terminology-aware inputs.
3. Vite proxying in development for CORS-safe access to upstream FHIR and schema sources.
4. A pluggable provider model for local CRUD persistence and schema loading.
5. Local storage overlays for create/update/delete semantics against read-only upstream data.

## Architecture Overview

### Runtime Composition

- UI framework: React 18 + React Router.
- UI toolkit: Mantine + Tabler icons.
- FHIR client/runtime context: MedplumProvider with a custom SchemaAwareMedplumClient.
- Data access:
  - Read/search from upstream FHIR via `fhirClient.ts`.
  - Local overlay from `localCrudStore.ts`.
- Editing:
  - Medplum `ResourceForm` for structured editing.
  - JSON editor mode for raw resource editing.

### Key Modules

- `src/main.tsx`
  - Bootstraps app providers.
  - Registers default schema provider.
  - Constructs Medplum client using proxied base URLs in dev.
- `src/App.tsx`
  - Top-level route map for home/create/detail pages.
- `src/fhirClient.ts`
  - Thin fetch wrapper for read/search operations.
  - Applies local overlay on server responses.
- `src/localCrudStore.ts`
  - `CrudProvider` abstraction.
  - Default localStorage implementation.
  - Overlay and delete tombstone behavior.
- `src/fhirSchemaProvider.ts`
  - `FhirSchemaProvider` abstraction.
  - Default R5 schema loader (HL7 source via proxy).
  - `SchemaAwareMedplumClient` override hooks for schema/profile requests.
- `src/components/ResourceCrudPanel.tsx`
  - Read view (`ResourceTable`), form edit (`ResourceForm`), JSON edit mode, local delete/restore.
- `src/pages/CreateResourcePage.tsx`
  - New-resource flow with form and raw JSON modes.

### Development Proxy Topology

- `/fhir-proxy/*` -> `https://google-fhir.fhir-aggregator.org/*`
- `/schema-proxy/*` -> `https://hl7.org/fhir/*`

This keeps browser calls same-origin during development while preserving real upstream behavior.

## Dependency Strategy

### Core Dependencies and Why

- `@medplum/core`
  - FHIR client behavior, schema APIs, terminology operations.
- `@medplum/react`
  - `ResourceForm`, `ResourceTable`, and typed FHIR UI primitives.
- `@medplum/fhirtypes`
  - Type safety across resource models.
- `react`, `react-dom`, `react-router-dom`
  - SPA rendering and routing.
- `@mantine/*`
  - Fast, consistent UI building blocks.
- `vite` + `@vitejs/plugin-react`
  - Fast local development and proxy control.

### Dependency Tradeoffs

- Pros:
  - Rapid implementation velocity.
  - Strong leverage of maintained FHIR-specific UI behavior.
  - Reduced need to build/maintain custom form engines.
- Cons:
  - Tight coupling to Medplum component behavior and versions.
  - Runtime dependence on terminology/schema availability for best UX.

## Applicability for a POC

This architecture is a strong fit for a POC because:

1. It demonstrates realistic end-user workflows (browse, inspect, edit, local save/delete) without requiring a write-enabled FHIR backend.
2. It proves integration feasibility with real upstream data.
3. It allows plugin-style extension points (CRUD provider, schema provider) without broad refactors.
4. It enables quick UX iteration with both form-based and raw JSON editing paths.

## Shortcomings / Known Limitations

1. Local CRUD is browser-scoped and non-collaborative.
2. No authoritative write-back to the upstream system.
3. Conflict/version handling is minimal (no optimistic concurrency with ETags/version IDs).
4. Terminology/schema latency and upstream availability can affect form responsiveness.
5. No authentication/authorization model beyond upstream public access assumptions.
6. Error handling and observability are basic (limited structured telemetry).
7. Dependency version drift risk exists (Medplum package versions are not fully aligned in `package.json`).
8. Test coverage and CI quality gates are limited for production readiness.

## Consequences

### Positive

- Delivers a usable POC with low infrastructure footprint.
- Preserves a clear migration path to backend persistence.
- Keeps domain modeling close to FHIR-native semantics.

### Negative

- Not production-grade for multi-user data integrity.
- Runtime behavior remains partially dependent on external terminology/schema endpoints.
- Requires additional hardening before regulated or high-availability use.

## Next Steps

1. Implement a backend `CrudProvider` for shared persistence and auditability.
2. Add write-through mode options (local overlay only vs backend persist vs hybrid).
3. Add resource versioning/conflict detection using FHIR version metadata.
4. Add robust error taxonomy and user-facing retry guidance.
5. Add observability:
   - structured client logging
   - request correlation IDs
   - failure dashboards
6. Add automated tests:
   - local CRUD overlay behavior
   - schema provider behavior
   - create/edit/delete flows
7. Align Medplum dependency versions (`core`, `react`, `fhirtypes`) and pin compatibility policy.
8. Add security roadmap:
   - auth integration
   - role-based restrictions
   - protected proxy strategy for production.

## References

- `README.md` (current project framing and quick-start guidance)
- `src/main.tsx`
- `src/fhirClient.ts`
- `src/localCrudStore.ts`
- `src/fhirSchemaProvider.ts`
- `src/components/ResourceCrudPanel.tsx`
- `src/pages/CreateResourcePage.tsx`
- `vite.config.ts`
