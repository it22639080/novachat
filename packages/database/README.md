# NovaChat AI Database

This package owns the Prisma schema, migrations, seed script, and database client setup for NovaChat AI.

## Tenant Isolation Strategy

`Tenant` is the business boundary. Every tenant-specific model includes `tenantId`, including customers, conversations, messages, leads, products, orders, appointments, campaigns, chatbots, knowledge base records, AI logs, notifications, invoices, and payments.

API code must resolve tenant context from authenticated membership, then include `tenantId` in every tenant-owned query. Client-provided tenant ids are never enough on their own. Global platform records such as `Plan` and `Permission` do not include `tenantId` because they are shared by the platform.

Tenant-local uniqueness is modeled with compound constraints such as:

- `Customer`: `tenantId + phone`
- `Product`: `tenantId + sku`
- `Tag`: `tenantId + name`
- `LeadStage`: `tenantId + name` and `tenantId + position`
- `Invoice`: `tenantId + number`

This prevents cross-tenant data mixing while still allowing different businesses to use the same customer phone, SKU, tag, or invoice number inside their own workspace.

## Data Retention and Deletes

Durable business records use `deletedAt` for soft deletion where useful. Relationships use conservative delete behavior:

- `Restrict` for tenant-owned business data to avoid accidental tenant-level data loss.
- `SetNull` for optional actor/assignee/customer references where historical records should survive.
- `Cascade` only for tightly owned child records such as order items, campaign recipients, chatbot flow records, and document chunks.

## pgvector and RAG

`KnowledgeBaseChunk.embedding` uses `vector(1536)` through pgvector. Later AI/RAG retrieval will:

1. Filter chunks by `tenantId`.
2. Exclude soft-deleted chunks.
3. Rank candidate chunks by vector similarity.
4. Pass only tenant-owned context into the assistant prompt.

The migration adds an IVFFlat cosine index on embeddings for future similarity search.

## Commands

Prisma commands load environment variables from the monorepo root and from this package. Example files are loaded first for local defaults, then real ignored env files override them:

- Workspace: `.env.example`, `.env`, `.env.local`
- Database package: `packages/database/.env.example`, `packages/database/.env`, `packages/database/.env.local`

Use a real `DATABASE_URL` in the root `.env` for local development and deployment. The committed examples are only safe defaults for local Docker.

Generate Prisma client:

```bash
pnpm db:generate
```

Create/apply a development migration:

```bash
pnpm db:migrate
```

Seed demo data:

```bash
pnpm db:seed
```

Reset local database and run migrations:

```bash
pnpm db:reset
```

Open Prisma Studio:

```bash
pnpm db:studio
```

## Seed Data

The seed script creates:

- Super admin user: `superadmin@novachat.ai`
- Demo tenant: `ABC Fashion`
- Owner user: `owner@abcfashion.test`
- Manager user: `manager@abcfashion.test`
- Agent user: `agent@abcfashion.test`
- Demo customers
- Demo conversations and messages
- Demo products and category
- Demo lead stages and lead
- Demo subscription plan
