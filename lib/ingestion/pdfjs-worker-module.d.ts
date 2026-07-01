// pdf.js's legacy build entries have no colocated type declarations. We import
// the runtime from the legacy build (transpiled + core-js polyfills for older
// browsers) and cast it to the typed 'pdfjs-dist' namespace in pdf-adapter.ts;
// the worker module is imported only for its side effect (registering
// globalThis.pdfjsWorker so pdf.js runs on the main thread). Untyped module
// declarations are sufficient for both.
declare module 'pdfjs-dist/legacy/build/pdf.mjs';
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
