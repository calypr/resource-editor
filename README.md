# FHIR Aggregator Browser

A React SPA built with [Medplum's React component library](https://storybook.medplum.com/)
that lets you explore biomedical research data from [fhir-aggregator.org](https://fhir-aggregator.org).

## Features

- 🔬 Browse **ResearchStudies** from TCGA, GDC, HTAN, ICGC, GTEx, and more
- 🔍 Search studies by identifier (e.g. `TCGA-BRCA`) with quick-pick buttons
- 📋 Study detail view: description, focus, keywords, subjects, specimens
- 🧬 **ResearchSubject** and **Specimen** tables with drill-through navigation
- 🗃️ Raw FHIR JSON viewer
- ✏️ Local create, update, and delete overlay for read-only servers
- 🔌 CRUD provider plugin contract (`CrudProvider`) for swapping local storage with a custom backend
- 🌐 Server selector — swap FHIR base at runtime
- 🚀 Vite dev proxy avoids browser CORS restrictions in development

## Quick Start

```bash
npm install
npm run dev   # → http://localhost:5173
```

## Docker

A production-oriented container setup is available in [Dockerfile](Dockerfile).

Build and run:

```bash
docker build -t resource-editor:latest .
docker run --rm --name resource-editor -p 4173:80 resource-editor:latest
```

Then open `http://localhost:4173`.

Important: the container listens on port `80`, so host mapping must be `-p <host-port>:80`.

If you previously started it with the wrong mapping (for example `-p 4173:4173`), restart with:

```bash
docker rm -f resource-editor
docker run --rm --name resource-editor -p 4173:80 resource-editor:latest
```

Build-time and runtime environment variables are documented in [docs/docker.md](docs/docker.md).

## Project Structure

```text
src/
├── main.tsx                    # App bootstrap: MedplumProvider + MantineProvider
├── App.tsx                     # Router / route definitions
├── fhirClient.ts               # Thin fetch wrapper + CRUD overlay application
├── localCrudStore.ts           # CRUD provider contract + active provider registry
├── plugins/
│   └── customBackendCrudProvider.ts # Template plugin for backend CRUD persistence
├── components/
│   ├── AppLayout.tsx           # AppShell header + server switcher
│   └── StudyCard.tsx           # ResearchStudy summary card
└── pages/
    ├── HomePage.tsx            # Paginated study browser with search
    ├── StudyDetailPage.tsx     # 4-tab study detail (overview/subjects/specimens/raw)
    └── ResourceDetailPage.tsx  # Generic FHIR resource drillthrough
```

## Key FHIR Aggregator Endpoints

```text
FHIR_BASE = https://google-fhir.fhir-aggregator.org

GET /ResearchStudy?_count=12&_sort=-_lastUpdated
GET /ResearchStudy?identifier=TCGA-BRCA
GET /ResearchStudy/{id}
GET /ResearchSubject?study=ResearchStudy/{id}&_count=100
GET /Specimen?_count=50
GET /{ResourceType}/{id}
```

## Medplum Components Used

| Component | Usage |
| --- | --- |
| `<MedplumProvider>` | Supplies `MedplumClient` context to the whole tree |
| `<ResourceTable value={resource} />` | Renders any FHIR resource as a structured key/value table |
| `<CodeableConceptDisplay value={...} />` | Renders FHIR `CodeableConcept` display text |

## Dev Proxy (CORS)

The Vite dev server proxies `/fhir-proxy/*` → `https://google-fhir.fhir-aggregator.org/*`
to avoid browser CORS restrictions during local development.

For production, deploy behind a reverse proxy or configure CORS on the FHIR server.

## CRUD Plugin Architecture

The app uses a provider pattern so CRUD persistence can be swapped without changing pages/components.

- `CrudProvider` interface in `src/localCrudStore.ts`
- Active provider registry via `setCrudProvider(...)`
- Default provider: local storage (`createLocalStorageCrudProvider()`)
- Custom backend template: `src/plugins/customBackendCrudProvider.ts`

To switch providers during bootstrap, register your implementation in `src/main.tsx` before rendering:

```ts
import { setCrudProvider } from './localCrudStore';
import { createCustomBackendCrudProvider } from './plugins/customBackendCrudProvider';

setCrudProvider(createCustomBackendCrudProvider({
    baseUrl: 'https://your-crud-api.example.com',
}));
```
