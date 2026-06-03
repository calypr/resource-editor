# ADR 0004: Docker Compose Service Topology as the Next Step

- Status: Proposed
- Date: 2026-06-03
- Deciders: Resource Editor maintainers

## Context

The project now has a production-oriented Docker image and documentation for build-time/runtime variables.

Current containerization state:

1. Single container serving static frontend assets.
2. No bundled reverse proxy or API mediation layer.
3. No backend persistence service for CRUD plugin replacement.

For local integration and production-like validation, the next step is to define a Docker Compose topology that can scale from minimal POC to a more realistic deployment shape.

## Decision

Adopt a phased Docker Compose service model with one required service and several optional services.

### Required Service

1. `app`

- Builds from `Dockerfile`.
- Serves the static SPA.
- Uses build args `VITE_FHIR_BASE_URL` and `VITE_SCHEMA_BASE_URL`.
- Accepts runtime `PORT`.

### Optional Services

1. `reverse-proxy`

- Fronts `app` with Nginx or Caddy.
- Provides SPA routing fallback and stable external routing.
- Can own TLS termination and cache headers.

1. `fhir-proxy` (or `api-gateway`)

- Mediates outbound FHIR and schema requests.
- Centralizes CORS handling, auth headers, and URL rewriting.
- Reduces browser-direct dependency on upstream CORS behavior.

1. `mock-fhir` (dev/test profile)

- Provides local/offline FHIR test data.
- Supports repeatable demos and integration tests.

1. `crud-api` (future plugin backend)

- Replaces browser-local CRUD storage with shared persistence.
- May be paired with `postgres` if relational storage is selected.

## Service Profiles

Use Compose profiles to keep startup lightweight:

1. `default`: `app`
1. `edge`: `app`, `reverse-proxy`
1. `gateway`: `app`, `reverse-proxy`, `fhir-proxy`
1. `test`: `app`, `mock-fhir`
1. `shared-crud`: `app`, `crud-api` (+ `postgres` if needed)

## Consequences

### Positive

1. Clear path from POC runtime to production-like topology.
2. Incremental adoption without forcing backend complexity on every environment.
3. Better reliability for schema/terminology workflows when using a gateway.
4. Better support for team/shared CRUD workflows once `crud-api` is added.

### Negative

1. More operational surface area (service config, networking, health checks).
2. Additional maintenance burden for proxy/gateway images and configuration.
3. Potential divergence if profile combinations are not regularly tested.

## Implementation Notes

1. Keep `app` build-time variables aligned with [docs/docker.md](docker.md).
2. Start with `app` + `reverse-proxy` for immediate value.
3. Add `fhir-proxy` only when CORS/auth/rewrite requirements exceed static hosting constraints.
4. Add `crud-api` only when collaboration/shared persistence becomes a requirement.

## Next Steps

1. Create `docker-compose.yml` with `app` and `reverse-proxy` as initial services.
2. Add optional Compose profiles for `gateway`, `test`, and `shared-crud`.
3. Add service health checks and a short runbook in `docs/docker.md`.
4. Add CI smoke test that runs `docker compose up` for the default profile and checks app availability.
