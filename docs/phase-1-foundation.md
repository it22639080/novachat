# Phase 1: Project Foundation

## Scope

This phase creates the scalable monorepo foundation for NovaChat AI without implementing product features such as authentication, WhatsApp, AI agents, campaigns, or billing.

## Decisions

- Prisma is owned by `packages/database`, not by the API app.
- Shared contracts live in `packages/shared-types`.
- Shared UI primitives live in `packages/ui`.
- Business dashboard and super admin are separate Next.js apps.
- API code is split by clean architecture layers.
- Redis, BullMQ, and Socket.IO are wired as foundation capabilities only.

## Security Baseline

- Environment variables are validated with Zod.
- Secrets are not hardcoded.
- API responses use a centralized envelope.
- Errors flow through a central handler.
- Logs redact common secret fields.
- Tenant isolation middleware is scaffolded for future protected APIs.

## Not Included

- Auth implementation.
- WhatsApp Business API connection.
- OpenAI/Gemini integration.
- Billing.
- Production CI/CD.
- Real tenant onboarding UI.
