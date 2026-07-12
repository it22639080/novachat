import { env } from "../../config/env.js";
import type { AiGenerateInput, AiGenerateResult, AiProviderClient } from "../../application/ai/ai-provider.js";
import { logger } from "../logger/logger.js";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
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

function messageForStatus(status: number, model: string) {
  if (status === 401) {
    return "OpenAI invalid API key";
  }

  if (status === 404) {
    return `OpenAI model not found: ${model}`;
  }

  if (status === 429) {
    return "OpenAI quota or rate limit error: 429";
  }

  return `OpenAI request failed with status ${status}`;
}

export class OpenAiProviderError extends Error {
  readonly status: number | undefined;
  readonly providerCode: string | undefined;
  readonly providerType: string | undefined;
  readonly responseBody?: unknown;

  constructor(params: {
    message: string;
    status?: number | undefined;
    providerCode?: string | undefined;
    providerType?: string | undefined;
    responseBody?: unknown;
  }) {
    super(params.message);
    this.name = "OpenAiProviderError";
    this.status = params.status;
    this.providerCode = params.providerCode;
    this.providerType = params.providerType;
    this.responseBody = params.responseBody;
  }
}

export class OpenAiProvider implements AiProviderClient {
  async generateReply(input: AiGenerateInput): Promise<AiGenerateResult> {
    if (!env.OPENAI_API_KEY) {
      throw new OpenAiProviderError({ message: "OPENAI_API_KEY missing" });
    }

    const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        messages: input.messages
      })
    });

    const rawBody = await response.text();
    const parsedBody = parseJsonBody(rawBody);
    const errorBody = asOpenAiErrorBody(parsedBody);

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          modelName: input.model,
          body: errorBody ?? parsedBody ?? rawBody
        },
        "OpenAI request failed"
      );

      throw new OpenAiProviderError({
        message: errorBody?.error?.message ?? messageForStatus(response.status, input.model),
        status: response.status,
        providerCode: errorBody?.error?.code,
        providerType: errorBody?.error?.type,
        responseBody: errorBody ?? parsedBody ?? rawBody
      });
    }

    const body = (parsedBody ?? {}) as OpenAiChatResponse;

    const text = body?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("OpenAI returned an empty reply");
    }

    return {
      text,
      promptTokens: body?.usage?.prompt_tokens ?? 0,
      outputTokens: body?.usage?.completion_tokens ?? 0,
      confidence: 0.74
    };
  }
}
