# ADR 0003: GitHub Pages Deployment vs Production Deployment

- Status: Accepted
- Date: 2026-06-03
- Deciders: Resource Editor maintainers

## Context

The application is currently a Vite + React SPA that relies on:

1. Browser-side routing (`react-router-dom`).
2. FHIR API access (`/fhir-proxy` in development via Vite proxy).
3. Schema loading for Medplum forms (`/schema-proxy` in development via Vite proxy, direct HL7 URL in production mode).
4. Local browser persistence for CRUD overlays (`localStorage`).

GitHub Pages is static hosting only. It cannot run server-side proxy routes or API middleware. We need a documented deployment posture for:

- A static GitHub Pages deployment for demos/POCs.
- A production deployment with robust routing, proxying, observability, and security controls.

## Decision

Support GitHub Pages as a **POC/static demo target only**.

For production use, deploy the SPA behind a controllable edge/backend layer that provides:

1. API proxying and policy enforcement.
2. Reliable schema/terminology access.
3. SPA routing fallback.
4. Operational controls (auth, telemetry, error handling, cache strategy).

## GitHub Pages Deployment (POC)

### Intended Use

- Public demo and lightweight evaluation.
- Non-critical workflows.
- Read-heavy scenarios with limited guarantees.

### Required Configuration

1. Vite base path must match repository Pages path (`/<owner>/<repo>/`).
2. SPA deep-link handling must be addressed:
   - Hash routing, or
   - 404-to-index SPA fallback approach.
3. All runtime API/schema endpoints must be directly browser-accessible with compatible CORS.

### Key Constraints

1. No server-side proxy endpoints (`/fhir-proxy`, `/schema-proxy`) at runtime.
2. Any dependency on non-CORS-compliant upstream services will fail in browser.
3. No secure secret handling on host (static client only).
4. Limited control over edge behavior, cache policy, and request rewriting.

### Operational Impact

- Faster setup and lower cost.
- Higher fragility for terminology/schema-dependent form features.
- Not suitable for workflows requiring strong reliability or governance.

## Production Deployment

### Intended Use

- Team/internal or external user-facing environments.
- Reliability-sensitive and extensible workflows.

### Recommended Runtime Topology

1. Static frontend hosting (CDN/object storage) behind managed domain.
2. Dedicated backend/edge proxy layer for FHIR and schema/terminology traffic.
3. SPA fallback/routing control at edge or origin.
4. Optional custom CRUD persistence provider for shared state beyond browser local storage.

### Production Capabilities

1. Centralized CORS and outbound request policy.
2. Stable FHIR schema and terminology mediation (including `ValueSet/$expand` behavior).
3. Authentication and authorization controls.
4. Structured logging/metrics and failure alerting.
5. Environment-level traffic governance and resilience patterns.

## Differences Summary

| Area | GitHub Pages (POC) | Production Deployment |
| --- | --- | --- |
| Hosting model | Static only | Static + backend/edge services |
| API proxy support | None | Full control |
| SPA deep links | Manual workaround needed | Proper fallback routing |
| Secrets handling | Not possible | Secure server-side handling |
| CORS resilience | Depends on every upstream | Controlled at proxy/edge |
| Schema/terminology reliability | Best effort | Managed and monitorable |
| Observability | Minimal | Centralized logs/metrics/alerts |
| Fit | Demo/POC | Real-world deployment |

## Consequences

### Positive

1. Clear separation between demo hosting and production expectations.
2. Fast path for public previews on GitHub Pages.
3. Reduced ambiguity when form behavior differs between dev/prod/static hosts.

### Negative

1. Additional deployment complexity for production readiness.
2. Need to maintain environment-specific configuration and documentation.

## Next Steps

1. Add explicit deployment docs for GitHub Pages build/base/routing setup.
2. Add production deployment reference architecture and runbook.
3. Externalize runtime config (FHIR base URL, schema base URL, feature flags).
4. Add automated smoke checks for:
   - Routing deep links
   - Resource read/search
   - Form schema load
   - ValueSet expansion behavior
5. Decide and implement a production proxy target (serverless edge, container API, or managed gateway).

## Related ADRs

- `docs/adr-0001-medplum-valueset-expand-contract.md`
- `docs/adr-0002-application-architecture-and-poc-fit.md`
