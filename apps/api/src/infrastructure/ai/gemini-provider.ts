import type { AiGenerateInput, AiGenerateResult, AiProviderClient } from "../../application/ai/ai-provider.js";

export class GeminiPlaceholderProvider implements AiProviderClient {
  async generateReply(_input: AiGenerateInput): Promise<AiGenerateResult> {
    throw new Error("Gemini provider is a placeholder and is not enabled yet");
  }
}
