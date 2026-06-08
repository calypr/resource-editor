# Docker Usage

This project includes a production-oriented Docker setup in [Dockerfile](../Dockerfile).

## What It Does

- Builds the Vite app in a Node 20 Alpine builder stage.
- Serves static files from `dist/` via Nginx.
- Includes same-origin proxy routes in the container:
  - `/fhir-proxy/*` -> `https://google-fhir.fhir-aggregator.org/*`
  - `/schema-proxy/*` -> `https://hl7.org/fhir/*`
- Supports configurable FHIR/schema endpoints through build-time Vite variables.

## Environment Variables

### Build-time variables (embedded into frontend bundle)

These must be provided during `docker build`.

1. `VITE_FHIR_BASE_URL`

- Default: `/fhir-proxy/`
- Used by: Medplum client and `fhirClient` for read/search operations.
- Typical values:
  - Container built-in proxy: `/fhir-proxy/`
  - Local reverse proxy: `http://localhost:8080/fhir`
  - Public FHIR API: `https://example.com/fhir`

1. `VITE_SCHEMA_BASE_URL`

- Default: `/schema-proxy/R5`
- Used by: schema provider for Medplum `ResourceForm` profile/schema resolution.
- Typical values:
  - Container built-in proxy: `/schema-proxy/R5`
  - Local schema mirror: `http://localhost:8080/fhir/R5`
  - Hosted schema source: `https://hl7.org/fhir/R5`

Important: because this is a static frontend build, changing these values requires rebuilding the image.

## Build and Run

Build with defaults:

```bash
docker build -t resource-editor:latest .
```

Build with explicit API/schema endpoints:

```bash
docker build \
  --build-arg VITE_FHIR_BASE_URL=https://google-fhir.fhir-aggregator.org/ \
  --build-arg VITE_SCHEMA_BASE_URL=https://hl7.org/fhir/R5 \
  -t resource-editor:latest .
```

Run on port 4173:

```bash
docker run --rm -p 4173:80 resource-editor:latest
```

Run on port 8080:

```bash
docker run --rm -p 8080:80 resource-editor:latest
```

## Notes

- This image includes a lightweight proxy layer for default FHIR/schema upstreams.
- If you override `VITE_FHIR_BASE_URL` or `VITE_SCHEMA_BASE_URL` to absolute browser URLs, upstream CORS rules still apply.
- For auth, policy enforcement, and advanced routing, use a dedicated API gateway or backend service.
