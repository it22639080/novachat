# Phase 7: Shared Inbox

## What Was Built

Phase 7 adds a tenant-scoped shared inbox for WhatsApp conversations. It includes:

- Socket.IO realtime server with tenant rooms.
- Inbox REST APIs for conversation lists, message threads, sends, assignments, statuses, reads, notes, tags, search, and assignees.
- Shared Zod validation schemas.
- Realtime event publishing from the existing message processing pipeline.
- A three-column dashboard inbox UI with conversation list, chat thread, composer, customer profile, assignment, tags, notes, and timeline.

## Architecture

The inbox follows the existing clean architecture shape:

- `packages/shared-types/src/schemas/inbox.ts` defines API contracts and validation.
- `apps/api/src/application/services/inbox-service.ts` owns tenant-scoped business logic.
- `apps/api/src/presentation/controllers/inbox-controller.ts` handles HTTP request/response mapping.
- `apps/api/src/infrastructure/realtime/realtime.ts` owns Socket.IO setup and tenant event publishing.
- `apps/dashboard/src/app/(dashboard)/inbox/page.tsx` provides the business inbox UI.

The simulator, WhatsApp webhook, WhatsApp send, and inbox send flows all use the same message storage pipeline where possible.

## Database

No migration is required for this phase. Existing models are used:

- `Conversation`
- `Message`
- `Customer`
- `Tag`
- `CustomerTag`
- `Note`
- `TenantMember`
- `WhatsAppAccount`

Unread state is represented by inbound messages with `status = RECEIVED`. Marking a thread as read changes matching inbound messages to `READ`.

## APIs

All routes require authentication and tenant context:

- `GET /api/v1/inbox/conversations`
- `GET /api/v1/inbox/conversations/search`
- `GET /api/v1/inbox/assignees`
- `GET /api/v1/inbox/conversations/:id/messages`
- `POST /api/v1/inbox/conversations/:id/messages`
- `PATCH /api/v1/inbox/conversations/:id/assign`
- `PATCH /api/v1/inbox/conversations/:id/status`
- `POST /api/v1/inbox/conversations/:id/read`
- `POST /api/v1/inbox/conversations/:id/notes`
- `POST /api/v1/inbox/conversations/:id/tags`
- `DELETE /api/v1/inbox/conversations/:id/tags/:tagId`

Conversation list supports pagination, search, sorting, status filters, assignee filters, unread filters, tag filters, and date filters.

## Realtime Events

Socket.IO clients authenticate using the existing access-token cookie and join only their active tenant room.

Events:

- `message:new`
- `conversation:updated`
- `conversation:assigned`
- `message:read`
- `note:created`

## Security

- Every query includes `tenantId`.
- Socket clients can only join the tenant in their access token.
- Agents can only see unassigned conversations and conversations assigned to them.
- Assignees must be active members of the current tenant.
- Tags and notes are written only after the conversation is validated inside the same tenant.

## Testing

Verified:

- Shared types typecheck and build.
- Prisma Client regenerated after dependency install.
- API typecheck and build.
- Dashboard typecheck and production build.
- Workspace tests pass.

Manual checklist:

1. Start Postgres and Redis.
2. Start the API and dashboard.
3. Log in and select a tenant.
4. Use the simulator to send an incoming message.
5. Open `/inbox` and verify the conversation appears.
6. Send a reply.
7. Add an internal note.
8. Assign the conversation to a team member.
9. Change status to `PENDING`, `RESOLVED`, and back to `OPEN`.
10. Open the dashboard in two browser tabs and verify realtime updates.
