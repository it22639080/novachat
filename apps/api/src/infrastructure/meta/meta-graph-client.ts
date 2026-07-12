import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";
import { badGateway, serviceUnavailable } from "../../shared/errors/app-error.js";

type MetaGraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MetaGraphRequestError = Error & {
  status?: number;
  body?: MetaGraphErrorBody | string | null;
};

type TokenExchangeResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type PhoneNumberResponse = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

type BusinessAccountResponse = {
  id: string;
  name?: string;
};

function graphUrl(path: string, searchParams?: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${env.META_API_VERSION}/${path.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestJson<T>(url: URL, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await parseBody(response);

  if (!response.ok) {
    const graphError = body as MetaGraphErrorBody | string | null;
    const safeUrl = new URL(url.toString());
    for (const sensitiveParam of ["access_token", "client_secret", "code"]) {
      if (safeUrl.searchParams.has(sensitiveParam)) {
        safeUrl.searchParams.set(sensitiveParam, "[REDACTED]");
      }
    }

    logger.warn(
      {
        status: response.status,
        url: safeUrl.toString(),
        body: graphError
      },
      "Meta Graph API request failed"
    );

    const message =
      typeof graphError === "object" && graphError && "error" in graphError
        ? graphError.error?.message
        : undefined;

    const error = badGateway(
      "META_GRAPH_REQUEST_FAILED",
      message ?? `Meta Graph API request failed with status ${response.status}`,
      { status: response.status }
    ) as MetaGraphRequestError;
    error.status = response.status;
    error.body = graphError;
    throw error;
  }

  return body as T;
}

function isRedirectMismatchError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const graphError = (error as MetaGraphRequestError).body;
  if (!graphError || typeof graphError !== "object" || !("error" in graphError)) {
    return false;
  }

  return graphError.error?.error_subcode === 36008;
}

export class MetaGraphClient {
  get isConfigured() {
    return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_CONFIG_ID && env.META_REDIRECT_URI);
  }

  assertConfigured() {
    if (!this.isConfigured) {
      throw serviceUnavailable(
        "META_EMBEDDED_SIGNUP_NOT_CONFIGURED",
        "Meta Embedded Signup is enabled but META_APP_ID, META_APP_SECRET, META_CONFIG_ID, or META_REDIRECT_URI is missing."
      );
    }
  }

  async exchangeCodeForAccessToken(code: string) {
    this.assertConfigured();

    const baseParams = {
      client_id: env.META_APP_ID ?? "",
      client_secret: env.META_APP_SECRET ?? "",
      code
    };

    // The Facebook JS SDK Embedded Signup flow can issue codes against either
    // its SDK callback URL or the configured redirect URI depending on app setup.
    const redirectAttempts = [
      undefined,
      env.META_REDIRECT_URI,
      "https://www.facebook.com/connect/login_success.html"
    ].filter((value, index, values): value is string | undefined => values.indexOf(value) === index);

    let body: TokenExchangeResponse | null = null;
    let lastError: unknown;

    for (const redirectUri of redirectAttempts) {
      const url = graphUrl("oauth/access_token", {
        ...baseParams,
        ...(redirectUri ? { redirect_uri: redirectUri } : {})
      });

      try {
        body = await requestJson<TokenExchangeResponse>(url, { method: "GET" });
        break;
      } catch (error) {
        lastError = error;
        if (!isRedirectMismatchError(error)) {
          throw error;
        }
      }
    }

    if (!body) {
      throw lastError;
    }

    if (!body.access_token) {
      throw badGateway("META_TOKEN_EXCHANGE_FAILED", "Meta did not return an access token.");
    }

    return {
      accessToken: body.access_token,
      expiresIn: body.expires_in
    };
  }

  async getPhoneNumber(phoneNumberId: string, accessToken: string) {
    const url = graphUrl(phoneNumberId, {
      fields: "id,display_phone_number,verified_name,quality_rating",
      access_token: accessToken
    });

    return requestJson<PhoneNumberResponse>(url, { method: "GET" });
  }

  async getWhatsAppBusinessAccount(wabaId: string, accessToken: string) {
    const url = graphUrl(wabaId, {
      fields: "id,name",
      access_token: accessToken
    });

    return requestJson<BusinessAccountResponse>(url, { method: "GET" });
  }

  async subscribeAppToWaba(wabaId: string, accessToken: string) {
    const url = graphUrl(`${wabaId}/subscribed_apps`);
    const body = new URLSearchParams({ access_token: accessToken });

    return requestJson<Record<string, unknown>>(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
  }
}
