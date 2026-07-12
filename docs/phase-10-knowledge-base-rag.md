# Phase 10: Knowledge Base and RAG

## What Was Built

Phase 10 adds tenant-scoped knowledge base ingestion and retrieval-augmented generation.

- TXT/CSV upload through JSON base64 payloads.
- PDF text extraction for text-based PDFs.
- DOCX text extraction from `word/document.xml`.
- Website URL knowledge sources.
- Text extraction, cleaning, chunking, and token estimates.
- OpenAI embeddings through `text-embedding-3-small`.
- pgvector storage in PostgreSQL.
- BullMQ queue for asynchronous document processing.
- Document statuses: `UPLOADED`, `PROCESSING`, `COMPLETED`, `FAILED`.
- Tenant-isolated semantic search.
- Knowledge test search and test answer APIs.
- Delete and reprocess actions.
- Source metadata on chunks for citation previews.
- AI Assistant Engine integration that injects retrieved chunks into prompts.

## Architecture

The implementation follows the existing clean architecture style:

- `packages/shared-types/src/schemas/knowledge.ts` defines Zod contracts.
- `apps/api/src/application/services/knowledge-service.ts` owns knowledge business logic.
- `apps/api/src/application/knowledge/text-processing.ts` owns extraction, cleaning, and chunking.
- `apps/api/src/infrastructure/ai/openai-embedding-provider.ts` owns embeddings.
- `apps/api/src/worker.ts` starts queue workers outside the HTTP API process.
- `apps/api/src/infrastructure/queue/knowledge-worker.ts` processes document jobs.
- `apps/api/src/presentation/controllers/knowledge-controller.ts` exposes HTTP handlers.
- `apps/dashboard/src/app/(dashboard)/knowledge-base/page.tsx` provides the UI.

## Database

Existing models are extended:

- `KnowledgeBaseDocument`
- `KnowledgeBaseChunk`

New fields include:

- `sourceType`
- `status`
- `fileName`
- `fileSize`
- `checksum`
- `error`
- `metadata`
- chunk `position`
- chunk source citation fields

Migration:

- `packages/database/prisma/migrations/20260708143000_phase_10_knowledge_rag/migration.sql`

Embeddings remain stored in:

```text
KnowledgeBaseChunk.embedding vector(1536)
```

## APIs

All routes require auth and tenant context:

- `POST /api/v1/knowledge/documents`
- `GET /api/v1/knowledge/documents`
- `GET /api/v1/knowledge/documents/:id`
- `DELETE /api/v1/knowledge/documents/:id`
- `POST /api/v1/knowledge/documents/:id/reprocess`
- `POST /api/v1/knowledge/test-search`
- `POST /api/v1/knowledge/test-answer`

Upload payload uses JSON:

```json
{
  "tenantId": "tenant-id",
  "title": "Services",
  "sourceType": "FILE",
  "fileName": "services.txt",
  "mimeType": "text/plain",
  "contentBase64": "..."
}
```

URL source payload:

```json
{
  "tenantId": "tenant-id",
  "title": "Pricing page",
  "sourceType": "URL",
  "sourceUrl": "https://example.com/pricing"
}
```

## AI Integration

For AI replies:

1. Receive customer message.
2. Build customer and conversation context.
3. Search tenant knowledge chunks using OpenAI embeddings and pgvector.
4. Add top retrieved chunks to the prompt.
5. Generate reply with the configured AI provider.
6. Save AI logs.

No cross-tenant chunks are queried. Every retrieval query includes `tenantId`.

## Security

- Every document and chunk has `tenantId`.
- All API routes use `tenantContext`.
- Semantic search filters by tenant and completed documents.
- Delete and reprocess validate tenant ownership.
- OpenAI keys remain backend-only.
- Source previews never expose API keys.

## Environment

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
REDIS_URL=redis://localhost:6380
```

OpenAI credits are required for embeddings and test answers.

## Run Commands

Stop any running API process before Prisma generation on Windows.

```powershell
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:generate
pnpm dev:api
pnpm dev:worker
pnpm dev:dashboard
```

Open:

```text
http://localhost:3000/knowledge-base
```

Keep `pnpm dev:api` running for dashboard/API requests. Run `pnpm dev:worker` in a separate terminal only when you want queued Knowledge Base documents and scheduled usage jobs to process.

## Testing Checklist

1. Log in and select a tenant.
2. Open `/knowledge-base`.
3. Upload a `.txt` or `.csv` file.
4. Confirm status moves from `UPLOADED` to `PROCESSING` to `COMPLETED`.
5. Ask a question in test retrieval.
6. Confirm retrieved source chunks appear.
7. Click Answer and confirm an answer is generated if OpenAI credits are available.
8. Delete a document and confirm it disappears for that tenant.
9. Reprocess a document and confirm it is queued again.
10. Open `/ai-assistant` or `/simulator` and confirm AI prompts include tenant knowledge when relevant.

## Notes

PDF/DOCX extraction is intentionally isolated behind parser functions. Text-based PDFs and standard DOCX files are supported. Scanned PDFs require OCR, which should be added as a separate production processing capability.
