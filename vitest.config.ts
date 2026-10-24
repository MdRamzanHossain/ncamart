import { defineConfig } from "vitest/config";
import path from "path";

const srcPath = path.resolve(__dirname, "./src");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": srcPath,
          },
        },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts", "node_modules"],
          environment: "node",
        },
      },
      {
        resolve: {
          alias: {
            "@": srcPath,
          },
        },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          exclude: ["node_modules"],
          environment: "node",
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
