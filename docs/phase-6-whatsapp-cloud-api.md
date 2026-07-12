# Phase 6: Official WhatsApp Cloud API Integration

## Purpose

NovaChat AI now supports official Meta WhatsApp Cloud API account setup, webhook verification, inbound webhook processing, outbound sends, and delivery/read status tracking.

This phase does not use unofficial WhatsApp automation.

## Architecture

- `WhatsAppService` manages account configuration, webhook handling, outbound message sends, and provider status updates.
- `WhatsAppCloudClient` calls Meta Graph API `/{phone-number-id}/messages`.
- `MessageProcessingService` remains the shared storage pipeline for both simulator messages and real WhatsApp webhook messages.
- `secret-crypto.ts` encrypts access tokens before storage using AES-256-GCM.

Future channel adapters should keep translating provider payloads into `MessageProcessingService` instead of duplicating customer/conversation/message logic.

## Database

No migration is required. Phase 6 uses existing tenant-scoped models:

- `WhatsAppAccount`
- `Customer`
- `Conversation`
- `Message`

The access token is stored in `WhatsAppAccount.encryptedAccessToken`. Raw webhook data is stored in `Message.metadata` for debugging.

## Environment

```env
WHATSAPP_GRAPH_API_VERSION=v20.0
WHATSAPP_TOKEN_ENCRYPTION_KEY=replace_with_at_least_32_characters_for_token_encryption
```

If `WHATSAPP_TOKEN_ENCRYPTION_KEY` is not set, local development falls back to `JWT_SECRET` for encryption key derivation. Production should set a dedicated key.

## APIs

Webhook endpoints:

- `GET /api/v1/webhooks/whatsapp`
- `POST /api/v1/webhooks/whatsapp`

Account endpoints:

- `POST /api/v1/whatsapp/accounts`
- `GET /api/v1/whatsapp/accounts`
- `PATCH /api/v1/whatsapp/accounts/:id`
- `DELETE /api/v1/whatsapp/accounts/:id`

Send endpoints:

- `POST /api/v1/whatsapp/send-text`
- `POST /api/v1/whatsapp/send-media`
- `POST /api/v1/whatsapp/send-template`
- `POST /api/v1/whatsapp/send-buttons`
- `POST /api/v1/whatsapp/send-list`

## Webhook Behavior

Verification:

- Reads Meta `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- Matches `hub.verify_token` against saved tenant WhatsApp accounts.
- Returns the challenge on success.

Incoming messages:

- Reads `entry[].changes[].value.metadata.phone_number_id`.
- Maps `phone_number_id` to `WhatsAppAccount`.
- Creates/updates tenant customer.
- Creates/reuses tenant conversation.
- Stores inbound message with provider message ID and raw payload metadata.

Statuses:

- Reads `statuses[]`.
- Updates message status by provider message ID.
- Stores raw status payload in metadata.

## Frontend

Dashboard route:

```text
/settings
```

Features:

- Add WhatsApp account
- Save Phone Number ID and Business Account ID
- Save encrypted access token
- Save webhook verify token
- See connection status
- See webhook setup checklist
- Send test text message
- View last webhook metadata

## Security

- Access tokens are never returned after saving.
- Tokens are encrypted before database storage.
- UI only shows masked token state.
- Webhook verify token is validated before challenge response.
- Signature validation is intentionally left as the next hardening step because it requires raw request body capture and Meta app secret configuration.

## Testing Checklist

1. Start Docker, API, and dashboard.
2. Log in and select a tenant.
3. Open `/settings`.
4. Add a WhatsApp account with a real Cloud API access token.
5. Configure Meta webhook callback URL:

```text
https://YOUR_API_DOMAIN.com/api/v1/webhooks/whatsapp
```

6. Use the saved verify token in Meta webhook setup.
7. Send an inbound WhatsApp test message.
8. Confirm customer/conversation/message records are created.
9. Send a test text message from the settings page.
10. Confirm provider message ID is stored and statuses update on delivery/read webhooks.
