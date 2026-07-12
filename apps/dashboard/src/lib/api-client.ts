export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiRequestOptions = {
  tenantId?: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, failure: ApiFailure) {
    super(failure.error.message);
    this.status = status;
    this.code = failure.error.code;
    this.details = failure.error.details;
  }
}

function isApiSuccess<T>(payload: unknown): payload is ApiSuccess<T> {
  return Boolean(payload && typeof payload === "object" && "success" in payload && payload.success === true);
}

function isApiFailure(payload: unknown): payload is ApiFailure {
  return Boolean(payload && typeof payload === "object" && "success" in payload && payload.success === false);
}

function parseResponseBody(body: string) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function createHeaders(initHeaders: HeadersInit | undefined, options: ApiRequestOptions) {
  const headers = new Headers(initHeaders);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (options.tenantId) {
    headers.set("x-tenant-id", options.tenantId);
  }

  headers.set("x-novachat-csrf", "same-origin");

  return headers;
}

const refreshExemptPaths = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/refresh"
]);

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const method = init.method ?? "GET";
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: createHeaders(init.headers, options)
  });

  if (response.status === 401 && retry && !refreshExemptPaths.has(path)) {
    await request("/auth/refresh", { method: "POST" }, false);
    return request<T>(path, init, false, options);
  }

  const responseBody = parseResponseBody(await response.text());

  if (!response.ok) {
    console.error("API Error:", {
      status: response.status,
      method,
      url,
      body: responseBody
    });

    if (isApiFailure(responseBody)) {
      throw new ApiClientError(response.status, responseBody);
    }

    throw new Error(`API request failed with status ${response.status}`);
  }

  if (isApiFailure(responseBody)) {
    console.error("API Error:", {
      status: response.status,
      method,
      url,
      body: responseBody
    });
    throw new ApiClientError(response.status, responseBody);
  }

  if (!isApiSuccess<T>(responseBody)) {
    console.error("API Error:", {
      status: response.status,
      method,
      url,
      body: responseBody
    });
    throw new Error("API response format is invalid");
  }

  return responseBody.data;
}

export const apiClient = {
  get: <T>(path: string, options: ApiRequestOptions = {}) => request<T>(path, {}, true, options),
  post: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    request<T>(
      path,
      body
        ? {
            method: "POST",
            body: JSON.stringify(body)
          }
        : { method: "POST" },
      true,
      options
    ),
  patch: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    request<T>(
      path,
      body
        ? {
            method: "PATCH",
            body: JSON.stringify(body)
          }
        : { method: "PATCH" },
      true,
      options
    ),
  delete: <T>(path: string, options: ApiRequestOptions = {}) =>
    request<T>(path, { method: "DELETE" }, true, options)
};
