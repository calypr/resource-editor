/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_FHIR_BASE_URL?: string;
	readonly VITE_SCHEMA_BASE_URL?: string;
	readonly VITE_IG_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}