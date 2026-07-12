export type AssistantPromptSettings = {
  businessName: string | null;
  businessDescription: string | null;
  tone: string;
  supportedLanguages: string[];
  openingHours: unknown;
  services: string[];
  policies: string[];
  fallbackMessage: string;
};

export type ConversationContext = {
  customerSummary: string;
  recentMessages: Array<{
    direction: string;
    senderType: string;
    text: string | null;
  }>;
  latestCustomerMessage: string;
  knowledgeChunks?: Array<{
    content: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    score: number;
  }>;
};

export function buildSystemPrompt(settings: AssistantPromptSettings) {
  return [
    "You are NovaChat AI, a business messaging assistant for WhatsApp.",
    "Reply as the business, not as a generic chatbot.",
    "Keep answers concise, helpful, and safe for customer support.",
    "If the question requires a human, politely say a team member will help.",
    `Business name: ${settings.businessName ?? "Not configured"}`,
    `Business description: ${settings.businessDescription ?? "Not configured"}`,
    `Tone: ${settings.tone}`,
    `Supported languages: ${settings.supportedLanguages.join(", ") || "English"}`,
    `Opening hours: ${JSON.stringify(settings.openingHours ?? "Not configured")}`,
    `Services: ${settings.services.join(", ") || "Not configured"}`,
    `Policies: ${settings.policies.join(" | ") || "Not configured"}`,
    `Fallback message: ${settings.fallbackMessage}`,
    "Use retrieved knowledge base context when it is provided.",
    "If knowledge context is missing or not relevant, use the fallback message or hand over to a human."
  ].join("\n");
}

export function buildUserPrompt(context: ConversationContext) {
  const recentMessages = context.recentMessages
    .map((message) => `${message.senderType}/${message.direction}: ${message.text ?? "Media message"}`)
    .join("\n");
  const knowledge = context.knowledgeChunks?.length
    ? context.knowledgeChunks
        .map(
          (chunk, index) =>
            `[${index + 1}] ${chunk.sourceTitle ?? "Knowledge source"} (${Math.round(chunk.score * 100)}% match)\n${chunk.content}`
        )
        .join("\n\n")
    : "No relevant knowledge base context was retrieved.";

  return [
    context.customerSummary,
    "Recent conversation:",
    recentMessages || "No previous messages.",
    "Retrieved knowledge base context:",
    knowledge,
    "Latest customer message:",
    context.latestCustomerMessage,
    "Write the next best reply."
  ].join("\n\n");
}
