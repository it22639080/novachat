export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiGenerateInput = {
  model: string;
  temperature: number;
  messages: AiChatMessage[];
};

export type AiGenerateResult = {
  text: string;
  promptTokens: number;
  outputTokens: number;
  confidence: number;
};

export interface AiProviderClient {
  generateReply(input: AiGenerateInput): Promise<AiGenerateResult>;
}
