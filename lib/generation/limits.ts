// Dependency-free generation limits, shared between the server schema and the
// client ingestion layer. Kept in its own leaf module so importing the constant
// (e.g. from a client component) does not pull in zod or the model catalog.

// Hard upper bound on source length. A single-call distillation prompt fits the
// whole source into one model context, so beyond this we fail fast with a clear
// error instead of risking a context-overflow failure mid-generation.
//
// 250k chars is ~62k tokens: comfortably within the smallest model in the catalog
// (gpt-4o, 128k) once prompt + bounded output are accounted for, and far below
// Claude (200k) / gpt-5 (400k). Distill mode condenses large input to a bounded
// outline and output tokens are capped, so input size is the only real
// constraint. (A model-aware cap derived from capabilities.contextWindow, and
// map-reduce chunking for arbitrarily large documents, are tracked as follow-ups.)
export const maxSourceTextCharacters = 250_000;

// Product target: keep node text readable and roomy, with a tighter target for the
// model while preserving a higher safety fallback for parser validation.
export const targetWordsPerLine = 70;
export const hardSafetyWordsPerLine = 90;
