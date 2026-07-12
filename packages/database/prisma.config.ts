import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";
import { loadDatabaseEnv } from "./prisma/load-env";

loadDatabaseEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
