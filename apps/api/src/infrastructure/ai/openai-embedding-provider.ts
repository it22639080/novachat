import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";
import { OpenAiProviderError } from "./openai-provider.js";

type OpenAiEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

type OpenAiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function parseJsonBody(body: string) {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function asOpenAiErrorBody(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    return body as OpenAiErrorBody;
  }

  return null;
}

export class OpenAiEmbeddingProvider {
  async embed(input: string) {
    if (!env.OPENAI_API_KEY) {
      throw new OpenAiProviderError({ message: "OPENAI_API_KEY missing" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let response: Response;

    try {
      response = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_EMBEDDING_MODEL,
          input
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenAiProviderError({
          message: "OpenAI embedding request timed out after 45 seconds"
        });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await response.text();
    const parsedBody = parseJsonBody(rawBody);
    const errorBody = asOpenAiErrorBody(parsedBody);

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          embeddingModel: env.OPENAI_EMBEDDING_MODEL,
          body: errorBody ?? parsedBody ?? rawBody
        },
        "OpenAI embedding request failed"
      );

      throw new OpenAiProviderError({
        message: errorBody?.error?.message ?? `OpenAI embedding request failed with status ${response.status}`,
        status: response.status,
        providerCode: errorBody?.error?.code,
        providerType: errorBody?.error?.type,
        responseBody: errorBody ?? parsedBody ?? rawBody
      });
    }

    const body = (parsedBody ?? {}) as OpenAiEmbeddingResponse;
    const embedding = body.data?.[0]?.embedding;

    if (!embedding?.length) {
      throw new OpenAiProviderError({ message: "OpenAI returned an empty embedding" });
    }

    return {
      embedding,
      promptTokens: body.usage?.prompt_tokens ?? body.usage?.total_tokens ?? 0
    };
  }
}
