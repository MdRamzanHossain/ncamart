import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "warn",
    },
  },
  // Module boundary protection rule
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/db/**",
      "src/test/**",
      "src/**/__tests__/**",
      "src/worker/**",
      "src/app/api/**",
      "src/modules/**/schema.ts",
      "src/modules/**/repo.ts",
      "src/modules/**/index.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/modules/*/schema*", "@/modules/*/repo*"],
              message:
                "Architecture Invariant Violation: Direct import of module schema or repo is forbidden. Modules must only expose service, events, policies, and DTOs via their public index.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "out/**",
      "*.config.mjs",
      "*.config.ts",
      "*.config.js",
      "*.cjs",
      "scripts/**",
      "src/lib/cache/redisCacheHandler.cjs",
    ],
  }
);
