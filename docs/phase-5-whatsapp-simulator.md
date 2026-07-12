# Phase 5: WhatsApp Simulator

## Purpose

The simulator lets NovaChat AI test WhatsApp-style messaging before Meta approval. It stores fake WhatsApp customers, conversations, and messages in the real tenant-scoped tables.

## Architecture

- `MessageProcessingService` is the shared ingestion pipeline for inbound and outbound messages.
- `SimulatorService` creates fake customers, conversations, outgoing messages, and reset behavior.
- `SimulatorController` exposes HTTP endpoints and validates inputs with shared Zod schemas.
- Future WhatsApp Cloud API webhooks should translate Meta payloads into `MessageProcessingService` inputs instead of duplicating storage logic.

## Database

No migration is required. The simulator uses existing models:

- `WhatsAppAccount`
- `Customer`
- `Conversation`
- `Message`

Simulator records are tenant-scoped and tagged with simulator metadata. Reset deletes only simulator-linked records for the active tenant.

## APIs

All endpoints require authentication and tenant context.

- `POST /api/v1/simulator/customers`
- `GET /api/v1/simulator/customers`
- `POST /api/v1/simulator/incoming-message`
- `POST /api/v1/simulator/outgoing-message`
- `GET /api/v1/simulator/conversations`
- `POST /api/v1/simulator/reset`

## Security

- Tenant isolation is enforced through `authenticate` and `tenantContext`.
- The backend uses `req.tenant.id`; clients do not directly choose the tenant boundary.
- Simulator reset is scoped to simulator records in the active tenant.

## Frontend

Dashboard route:

```text
/simulator
```

Features:

- Create fake customer
- Select fake customer
- Send fake incoming text, image, document, button reply, or list reply
- Store automatic system response
- Send fake outgoing delivered/read replies
- View message timeline
- Reset simulator data

## Testing Checklist

1. Start Docker, API, and dashboard.
2. Register or log in and select a tenant.
3. Open `/simulator`.
4. Create a fake customer.
5. Send a fake incoming message.
6. Confirm the conversation appears in the simulator timeline.
7. Open `/inbox` after future inbox API integration and confirm the same conversation appears there.
8. Send fake delivered/read outgoing messages.
9. Reset simulator data and confirm simulator records are removed.
