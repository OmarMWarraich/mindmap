// pdf.js ships its worker entry as a plain .mjs with no type declarations. We
// import it only for its side effect — it registers globalThis.pdfjsWorker so
// pdf.js runs its message handler on the main thread instead of spawning a Web
// Worker (see pdf-adapter.ts) — so an untyped module declaration is sufficient.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs';
