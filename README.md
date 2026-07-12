# NovaChat AI

Enterprise-grade multi-tenant SaaS foundation for AI-powered business messaging.

Phase 1 created the project foundation. Phase 2 added the complete Prisma schema foundation for the multi-tenant SaaS core. Phase 3 adds authentication, tenant switching, RBAC, and team access control. WhatsApp connection flows, chatbot runtime logic, billing provider integration, and production workflows are intentionally not implemented yet.

## Monorepo Structure

```text
novachat-ai/
  apps/
    api/            Express API foundation
    dashboard/      Business dashboard app
    super-admin/    Platform operator app
  packages/
    config/         Shared lint, format, and Tailwind config
    database/       Prisma schema, generated client setup, database scripts
    shared-types/   Shared Zod schemas and TypeScript contracts
    ui/             Shared Shadcn-style UI primitives
  docs/
  docker-compose.yml
  README.md
  .env.example
```

## Architecture

- `apps/api` uses modular clean architecture folders: `domain`, `application`, `infrastructure`, `presentation`, and `shared`.
- `packages/database` owns Prisma and PostgreSQL schema access.
- `packages/shared-types` owns shared API contracts, auth roles, tenant DTOs, and pagination schemas.
- `packages/ui` owns reusable UI components consumed by both Next.js apps.
- `packages/config` owns shared ESLint, Prettier, and Tailwind foundation config.

## Phase 2 Database Core

The database schema now includes the multi-tenant foundations for:

- Platform identity: `User`, `Tenant`, `TenantMember`, `Role`, `Permission`, `RolePermission`
- Billing and usage: `Plan`, `Subscription`, `UsageMetric`, `Invoice`, `Payment`
- Security tokens: `ApiKey`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`
- WhatsApp and messaging: `WhatsAppAccount`, `Customer`, `Conversation`, `Message`
- CRM and commerce: `Lead`, `LeadStage`, `Tag`, `Note`, `Product`, `ProductCategory`, `Order`, `OrderItem`
- Scheduling and growth: `Appointment`, `Campaign`, `CampaignRecipient`, `Notification`
- AI/RAG: `Chatbot`, `ChatbotFlow`, `KnowledgeBaseDocument`, `KnowledgeBaseChunk`, `AiAssistant`, `AiLog`

Every tenant-owned model includes `tenantId`. RAG chunks use pgvector with `vector(1536)` and a cosine index for future tenant-filtered retrieval.

## Phase 3 Auth And Access

Implemented backend endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/tenants/my-tenants`
- `POST /api/tenants/switch`
- `POST /api/team/invite`
- `GET /api/team/members`
- `PATCH /api/team/members/:id/role`
- `DELETE /api/team/members/:id`

Authentication uses httpOnly cookies for access and refresh tokens. Passwords are hashed with the bcrypt algorithm through `bcryptjs`, avoiding native build fragility while producing bcrypt-compatible hashes. Refresh tokens are stored only as SHA-256 hashes and rotate on refresh.

Dashboard auth pages now include register, login, forgot password, reset password, tenant selector, protected dashboard routes, token refresh, logout, and a profile area in the topbar.

## Phase 1 Backend Foundation

Included:

- Node.js + Express + TypeScript.
- Prisma-ready PostgreSQL access through `@novachat/database`.
- Redis and BullMQ-ready infrastructure adapters.
- Socket.IO-ready HTTP server.
- Zod validation.
- Central error handling.
- Central API response helper.
- Pino logger with secret redaction.
- Environment variable validation.
- Modular route/controller/service/repository layout.

Current API routes:

- `GET /api/v1/health`
- `GET /api/v1/me/tenants`
- `GET /api/v1/tenants/:tenantId/audit-logs`

## Phase 1 Frontend Foundation

Dashboard app:

- Next.js 15 App Router.
- TypeScript + Tailwind CSS.
- Shadcn-style shared UI package.
- Framer Motion dashboard shell.
- Auth placeholder pages.
- Sidebar, topbar, responsive layout.
- Empty overview states.
- Dark mode support.

Super Admin app:

- Next.js 15 App Router.
- Basic platform admin shell.
- Shared UI package.
- Dark mode-ready styling.

## Local Setup

Copy environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/super-admin/.env.example apps/super-admin/.env.local
```

Database commands read `DATABASE_URL` from the workspace `.env` first, with package-level database env files available for overrides. Keep real secrets in ignored `.env` files only.

Install dependencies:

```bash
pnpm install
pnpm approve-builds --all
```

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Generate Prisma client:

```bash
pnpm db:generate
```

Create a local migration:

```bash
pnpm db:migrate
```

Seed demo data:

```bash
pnpm db:seed
```

Reset local database:

```bash
pnpm db:reset
```

Run all apps:

```bash
pnpm dev
```

Run apps individually:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:dashboard
pnpm dev:super-admin
```

Run `pnpm dev:worker` in a separate terminal when you need background queue processing for Knowledge Base documents and scheduled usage jobs. The API process intentionally does not run heavy workers, so login and dashboard requests stay responsive.

## Docker

Infrastructure only:

```bash
docker compose up -d postgres redis
```

Application placeholders:

```bash
docker compose --profile app up --build
```

## Validation

```bash
pnpm build:packages
pnpm typecheck
pnpm test
pnpm build
```

## Next Step

Phase 2 should implement authentication and tenant onboarding:

- User registration/login.
- Tenant creation transaction.
- Owner membership creation.
- JWT issuance.
- RBAC enforcement tests.
- Dashboard onboarding flow.
