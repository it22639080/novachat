export type JsonRecord = Record<string, unknown>;

export function getRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function getArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(getRecord) : [];
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  return "View";
}

export function findCollection(payload: unknown, preferredKeys: string[]): JsonRecord[] {
  const root = getRecord(payload);

  for (const key of preferredKeys) {
    const collection = getArray(root[key]);
    if (collection.length > 0) {
      return collection;
    }
  }

  for (const value of Object.values(root)) {
    const collection = getArray(value);
    if (collection.length > 0) {
      return collection;
    }
  }

  return [];
}

export function queryString(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
