# FHIR Aggregator Browser

A React SPA built with [Medplum's React component library](https://storybook.medplum.com/)
that lets you explore biomedical research data from [fhir-aggregator.org](https://fhir-aggregator.org).

## Features

- 🔬 Browse **ResearchStudies** from TCGA, GDC, HTAN, ICGC, GTEx, and more
- 🔍 Search studies by identifier (e.g. `TCGA-BRCA`) with quick-pick buttons
- 📋 Study detail view: description, focus, keywords, subjects, specimens
- 🧬 **ResearchSubject** and **Specimen** tables with drill-through navigation
- 🗃️ Raw FHIR viewer via Medplum's `<ResourceTable>` component
- 🌐 Server selector — swap FHIR base at runtime
- 🚀 Vite dev proxy avoids browser CORS restrictions in development

## Quick Start

```bash
npm install
npm run dev   # → http://localhost:5173
```

## Project Structure

```
src/
├── main.tsx                    # App bootstrap: MedplumProvider + MantineProvider
├── App.tsx                     # Router / route definitions
├── fhirClient.ts               # Thin fetch wrapper for fhir-aggregator.org
├── components/
│   ├── AppLayout.tsx           # AppShell header + server switcher
│   └── StudyCard.tsx           # ResearchStudy summary card
└── pages/
    ├── HomePage.tsx            # Paginated study browser with search
    ├── StudyDetailPage.tsx     # 4-tab study detail (overview/subjects/specimens/raw)
    └── ResourceDetailPage.tsx  # Generic FHIR resource drillthrough
```

## Key FHIR Aggregator Endpoints

```
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
|---|---|
| `<MedplumProvider>` | Supplies `MedplumClient` context to the whole tree |
| `<ResourceTable value={resource} />` | Renders any FHIR resource as a structured key/value table |
| `<CodeableConceptDisplay value={...} />` | Renders FHIR `CodeableConcept` display text |

## Dev Proxy (CORS)

The Vite dev server proxies `/fhir-proxy/*` → `https://google-fhir.fhir-aggregator.org/*`
to avoid browser CORS restrictions during local development.

For production, deploy behind a reverse proxy or configure CORS on the FHIR server.
