# NovaChat AI Testing Guide

## Test Layers

- Unit tests: pure policy, schema, token, hashing, and utility behavior.
- Service tests: tenant isolation, RBAC, usage limits, AI pipeline decisions, billing rules.
- API tests: Express middleware, auth flows, validation, and route authorization.
- Integration tests: database-backed flows using a dedicated test database.
- Queue tests: BullMQ job scheduling and worker idempotency.
- External provider tests: WhatsApp/OpenAI/Gemini should use controlled fakes unless explicitly running provider smoke tests.

## Current Commands

```bash
pnpm --filter @novachat/shared-types test
pnpm --filter @novachat/api test
pnpm test
```

## CI Command

```bash
pnpm test:ci
```

The CI command builds shared packages, runs API coverage, and runs shared schema tests. If Vitest asks for a coverage provider, install the matching `@vitest/coverage-v8` version.

## Test Database Setup

Use a separate database from development:

```env
NODE_ENV=test
DATABASE_URL=postgresql://novachat:change_me_for_local_dev@127.0.0.1:55432/novachat_test?schema=public
REDIS_URL=redis://localhost:6380
JWT_SECRET=replace_with_at_least_32_characters_for_test
CSRF_PROTECTION_ENABLED=true
```

Recommended setup:

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm --filter @novachat/api test
```

For destructive integration tests, create and reset a dedicated `novachat_test` database only.

## Required Coverage Areas

- Auth: register, login, refresh rotation, logout, reset password, weak password rejection.
- Tenant isolation: users cannot read or mutate another tenant's customers, conversations, documents, campaigns, orders, appointments, or agents.
- RBAC: owner/admin/manager/agent/viewer permissions and Super Admin-only APIs.
- WhatsApp webhook: verification token, incoming message routing, delivery/read statuses, invalid payloads.
- AI pipeline: disabled AI, usage limit block, handover keyword, RAG context retrieval, provider failure handling.
- Campaign queue: opt-in enforcement, template requirement, rate limiting, retries, stop campaign.
- Billing: plan limits, subscription state, usage counters, top-ups, reset jobs.
- File upload: allowed MIME types, file size, failed extraction, tenant-scoped deletion.

## Coverage Report

```bash
pnpm test:coverage
```

Coverage should be reviewed for high-risk modules first: auth, tenant access, billing/usage, webhook handling, AI pipeline, and campaign sending.
