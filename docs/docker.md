# Docker Usage

This project includes a production-oriented Docker setup in [Dockerfile](../Dockerfile).

## What It Does

- Builds the Vite app in a Node 20 Alpine builder stage.
- Serves static files from `dist/` in a small runtime stage using `serve`.
- Supports configurable FHIR/schema endpoints through build-time Vite variables.

## Environment Variables

### Build-time variables (embedded into frontend bundle)

These must be provided during `docker build`.

1. `VITE_FHIR_BASE_URL`

- Default: `https://google-fhir.fhir-aggregator.org/`
- Used by: Medplum client and `fhirClient` for read/search operations.
- Typical values:
  - Local reverse proxy: `http://localhost:8080/fhir`
  - Public FHIR API: `https://example.com/fhir`

1. `VITE_SCHEMA_BASE_URL`

- Default: `https://hl7.org/fhir/R5`
- Used by: schema provider for Medplum `ResourceForm` profile/schema resolution.
- Typical values:
  - Local schema mirror: `http://localhost:8080/fhir/R5`
  - Hosted schema source: `https://hl7.org/fhir/R5`

Important: because this is a static frontend build, changing these values requires rebuilding the image.

### Runtime variable

1. `PORT`

- Default: `4173`
- Used by: `serve` in the runtime container.

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
docker run --rm -p 4173:4173 resource-editor:latest
```

Run on a custom port:

```bash
docker run --rm -e PORT=8080 -p 8080:8080 resource-editor:latest
```

## Notes

- This Docker image serves only static frontend assets.
- It does not provide a backend proxy layer.
- If your target FHIR/schema endpoints require auth, CORS mediation, or URL rewriting, use an external API gateway or backend service.
