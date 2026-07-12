# Phase 8: CRM and Lead Pipeline

## What Was Built

Phase 8 adds real customer management and lead pipeline functionality:

- Customer CRUD with soft delete.
- Customer profile with timeline, notes, tags, conversations, and leads.
- CSV customer import and export.
- Lead CRUD.
- Lead stage management.
- Kanban pipeline with drag/drop stage updates.
- Lead assignment to active tenant members.
- Lead value, source, expected close date, follow-up reminder, score, won/lost status.
- AI lead scoring and follow-up suggestion placeholders.

## Architecture

The implementation follows the established clean architecture pattern:

- `packages/shared-types/src/schemas/crm.ts` contains shared Zod schemas and TypeScript types.
- `apps/api/src/application/services/crm-service.ts` owns tenant-scoped CRM business logic.
- `apps/api/src/presentation/controllers/crm-controller.ts` handles HTTP request/response mapping.
- `apps/api/src/presentation/routes/index.ts` exposes authenticated tenant routes.
- `apps/dashboard/src/app/(dashboard)/customers/page.tsx` provides the CRM customer UI.
- `apps/dashboard/src/app/(dashboard)/leads/page.tsx` provides the lead Kanban UI.

## Database

The existing `Customer`, `Lead`, `LeadStage`, `Note`, `Tag`, `CustomerTag`, and `Conversation` tables are reused.

New additive lead fields:

- `assignedUserId`
- `expectedCloseDate`
- `followUpAt`
- `followUpNote`
- `aiScoreMetadata`
- `aiNextAction`

Migration:

- `packages/database/prisma/migrations/20260707152000_phase_8_crm_lead_pipeline/migration.sql`

## APIs

Customer APIs:

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`
- `DELETE /api/v1/customers/:id`
- `POST /api/v1/customers/:id/notes`
- `POST /api/v1/customers/:id/tags`
- `DELETE /api/v1/customers/:id/tags`
- `POST /api/v1/customers/import`
- `GET /api/v1/customers/export`

Lead APIs:

- `GET /api/v1/leads`
- `GET /api/v1/leads/kanban`
- `POST /api/v1/leads`
- `PATCH /api/v1/leads/:id`
- `DELETE /api/v1/leads/:id`
- `PATCH /api/v1/leads/:id/stage`
- `PATCH /api/v1/leads/:id/outcome`
- `GET /api/v1/lead-stages`
- `POST /api/v1/lead-stages`

## Security

- Every CRM query includes `tenantId`.
- Assignment validates that the assignee is an active member of the current tenant.
- CSV import upserts only within the active tenant.
- CSV export returns only current-tenant customers.
- Deletes are soft deletes.

## Testing

Verified:

- Shared types build.
- Database package build.
- API typecheck.
- API build.
- Dashboard typecheck.
- Dashboard production build.
- Workspace test suite.

Note: `prisma generate` can fail on Windows with `EPERM` if a running Node dev server is holding the Prisma query engine DLL. Stop `pnpm dev:api` and `pnpm dev:dashboard`, then run `pnpm db:generate` again.

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
http://localhost:3000/customers
http://localhost:3000/leads
```
