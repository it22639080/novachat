# Phase 9: AI Assistant Engine

## What Was Built

Phase 9 adds a tenant-specific AI assistant engine that can reply to customer messages from the simulator and official WhatsApp Cloud API flows.

- AI provider abstraction.
- OpenAI provider implementation.
- Gemini provider placeholder.
- Tenant AI settings.
- Assistant business profile, tone, languages, services, policies, fallback message, and handover keywords.
- Prompt builder.
- Conversation and customer context builder.
- AI response logging.
- Confidence score placeholder.
- Human handover detection.
- Tenant-level AI enable/disable.
- Conversation-level AI enable/disable and handover flags.
- AI test reply endpoint.
- Dashboard AI Assistant settings page with test playground and logs.

AI is disabled by default for each tenant. Enable it from `/ai-assistant` after adding `OPENAI_API_KEY`.

## Architecture

The implementation follows the existing clean architecture layers:

- `packages/shared-types/src/schemas/ai.ts` defines shared Zod validation and API types.
- `apps/api/src/application/ai/ai-provider.ts` defines the provider interface.
- `apps/api/src/infrastructure/ai/openai-provider.ts` implements OpenAI chat completions.
- `apps/api/src/infrastructure/ai/gemini-provider.ts` is a placeholder for future Gemini fallback.
- `apps/api/src/application/ai/prompt-builder.ts` builds tenant-aware system and user prompts.
- `apps/api/src/application/services/ai-assistant-engine-service.ts` owns AI orchestration and logging.
- `apps/api/src/presentation/controllers/ai-controller.ts` maps HTTP requests to service calls.
- `apps/dashboard/src/app/(dashboard)/ai-assistant/page.tsx` provides the business-facing settings UI.

The simulator and WhatsApp webhook both call the same AI engine after saving an incoming message. That keeps the development simulator aligned with the future production WhatsApp pipeline.

## Database

Migration:

- `packages/database/prisma/migrations/20260707170000_phase_9_ai_assistant_engine/migration.sql`

Schema additions:

- `TenantAiSettings` stores tenant-scoped assistant configuration.
- `Conversation.aiEnabled` controls AI per conversation.
- `Conversation.humanHandover` blocks automated replies when human attention is needed.
- `AiLog.metadata` stores provider metadata such as confidence placeholder and fallback usage.

Tenant isolation:

- `TenantAiSettings` has a unique `tenantId`.
- Every AI settings, log, conversation, customer, and message query is scoped by `tenantId`.
- Conversation AI toggles validate that the conversation belongs to the active tenant.

## APIs

All routes require authentication and tenant context:

- `GET /api/v1/ai/settings`
- `PATCH /api/v1/ai/settings`
- `POST /api/v1/ai/test-reply`
- `GET /api/v1/ai/logs`
- `PATCH /api/v1/conversations/:id/ai-toggle`

Pipeline:

1. Save incoming message.
2. Identify tenant.
3. Identify customer.
4. Identify conversation.
5. Check tenant and conversation AI settings.
6. Detect handover keywords.
7. Build customer and conversation context.
8. Generate AI reply.
9. Save outgoing AI message.
10. Send through the channel adapter.
11. Emit realtime inbox events.
12. Store AI log.

## Security

- OpenAI and Gemini keys are backend-only environment variables.
- No provider secret is returned to the frontend.
- AI settings are tenant-scoped.
- Conversation toggles require tenant membership.
- WhatsApp sends still use encrypted account tokens from the existing WhatsApp integration.
- Provider failures are logged and return the configured tenant fallback message instead of exposing raw provider errors to customers.

## Environment Variables

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
GEMINI_API_KEY=
```

`OPENAI_API_KEY` is required for real AI replies. It can be blank for local development while AI is disabled.

## Testing

Verified:

- Shared types build.
- Prisma Client generation.
- Database package build.
- API typecheck.
- Dashboard typecheck.
- API production build.
- Dashboard production build.

Manual checklist:

1. Run the migration and regenerate Prisma Client.
2. Add `OPENAI_API_KEY` to `.env`.
3. Start Postgres, Redis, API, and dashboard.
4. Log in and select a tenant.
5. Open `/ai-assistant`.
6. Enable AI.
7. Save assistant profile details.
8. Use the test playground to generate a reply.
9. Use `/simulator` to send an incoming message.
10. Confirm the AI reply appears in `/inbox`.
11. Send a message containing a handover keyword.
12. Confirm the conversation switches to human handover and AI stops replying.

## Run Commands

```powershell
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:generate
pnpm dev:api
pnpm dev:dashboard
```

Open:

```text
http://localhost:3000/ai-assistant
http://localhost:3000/simulator
http://localhost:3000/inbox
```

## Next Step

Phase 10 should build the RAG knowledge base pipeline with document upload, chunking, embeddings in `pgvector`, retrieval, and tenant-scoped answer grounding.
