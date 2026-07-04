import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";
import nounsanitized from "eslint-plugin-no-unsanitized";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Security linting (docs/ISSUE_NO_16.md): flags child_process, non-literal
  // fs/require, unsafe regex, and DOM XSS sinks (innerHTML, insertAdjacentHTML,
  // document.write).
  security.configs.recommended,
  nounsanitized.configs.recommended,
  {
    rules: {
      // Fires on every `obj[key]` access; overwhelming false-positive rate on a
      // TypeScript codebase where indexed access is already type-checked. The
      // high-signal security rules stay on; this one is the documented exception.
      "security/detect-object-injection": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
