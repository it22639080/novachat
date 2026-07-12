import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type LoadEnvOptions = {
  override?: boolean;
};

const configDirectory = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(configDirectory, "../..");
const workspaceRoot = resolve(apiRoot, "../..");

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

export function loadApiEnv(): void {
  for (const envFile of [
    resolve(workspaceRoot, ".env.example"),
    resolve(apiRoot, ".env.example"),
  ]) {
    loadEnvFile(envFile);
  }

  for (const envFile of [
    resolve(workspaceRoot, ".env"),
    resolve(apiRoot, ".env"),
    resolve(workspaceRoot, ".env.local"),
    resolve(apiRoot, ".env.local"),
  ]) {
    loadEnvFile(envFile, { override: true });
  }
}
