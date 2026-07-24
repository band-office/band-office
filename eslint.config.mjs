import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", ".next.*/**", "app-runtime/**", "dist-desktop/**", "src/generated/**", "coverage/**", "data/**", "playwright-report/**", "test-results/**"]),
]);
