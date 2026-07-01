// Dependency-free generation limits, shared between the server schema and the
// client ingestion layer. Kept in its own leaf module so importing the constant
// (e.g. from a client component) does not pull in zod or the model catalog.

// Hard upper bound on source length. A single-call distillation prompt still has
// to fit the whole source in the model context, so beyond this we fail fast with
// a clear error instead of risking a context-overflow failure mid-generation.
export const maxSourceTextCharacters = 100_000;
