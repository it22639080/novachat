import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type LoadEnvOptions = {
  override?: boolean;
};

const prismaDirectory = dirname(fileURLToPath(import.meta.url));
const databasePackageRoot = resolve(prismaDirectory, "..");
const workspaceRoot = resolve(databasePackageRoot, "../..");

function parseEnvValue(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(path: string, options: LoadEnvOptions = {}): void {
  if (!existsSync(path)) {
    return;
  }

  const file = readFileSync(path, "utf8");

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = parseEnvValue(line.slice(separatorIndex + 1));

    if (!key || (!options.override && process.env[key] !== undefined)) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadDatabaseEnv(): void {
  for (const envFile of [
    resolve(workspaceRoot, ".env.example"),
    resolve(databasePackageRoot, ".env.example"),
  ]) {
    loadEnvFile(envFile);
  }

  for (const envFile of [
    resolve(workspaceRoot, ".env"),
    resolve(databasePackageRoot, ".env"),
    resolve(workspaceRoot, ".env.local"),
    resolve(databasePackageRoot, ".env.local"),
  ]) {
    loadEnvFile(envFile, { override: true });
  }
}
