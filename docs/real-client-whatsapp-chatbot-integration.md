# Real Client WhatsApp Chatbot Integration

This guide explains how to connect a real client's official WhatsApp Business number to NovaChat AI and make the AI assistant reply automatically.

NovaChat AI uses only the official Meta WhatsApp Business Platform / Cloud API. Do not use browser automation, QR-login tools, or unofficial WhatsApp libraries.

## Current NovaChat Readiness

The codebase already has the main production path:

- Tenant registration: `POST /api/v1/auth/register` creates a user, tenant, owner membership, starter plan, and subscription.
- Tenant selection: users switch tenant with `POST /api/v1/tenants/switch`; dashboard API calls send `x-tenant-id`.
- Business profile: the practical business profile currently lives in AI Assistant settings: business name, description, tone, languages, services, policies, fallback message, and handover keywords.
- Products/services: products are managed from Products. Services and appointments exist separately.
- WhatsApp accounts: `WhatsAppAccount` stores tenant-scoped phone number ID, WABA/business account ID, status, onboarding method, encrypted token, webhook state, and health metadata.
- Manual WhatsApp setup: Settings -> WhatsApp Integration -> Manual Setup.
- Embedded Signup setup: Settings -> WhatsApp Integration -> Connect Automatically.
- Webhook route: `GET /api/v1/webhooks/whatsapp` verifies Meta webhook, `POST /api/v1/webhooks/whatsapp` receives events.
- Message processing: incoming messages create/update customer, conversation, and message records.
- AI pipeline: incoming messages call chatbot flow first, then AI Assistant if enabled.
- Knowledge Base / RAG: documents are uploaded, processed by the worker, embedded with OpenAI embeddings, searched with pgvector, and injected into the AI prompt.
- Usage limits: AI replies, token usage, WhatsApp sends, credits, and cost limits are enforced before live replies.
- Human handover: handover keywords or usage-limit blocks set `Conversation.humanHandover = true`.
- Inbox live update: message and conversation events are published to tenant Socket.IO rooms.
- Webhook logs: tenant Settings page now shows recent webhook logs.

## What Is Working vs What Still Needs Real Meta Setup

| Area | Status | How to verify |
| --- | --- | --- |
| Client tenant creation | Ready | Register a client from `/register`, then select the tenant. |
| Business details saving | Ready in AI Assistant settings | Save business name, description, services, policies, tone, and language. |
| Product/service setup | Ready | Add products in Products and services in Appointments/Services. |
| Manual WhatsApp connection | Ready | Save WABA ID, Phone Number ID, access token, and verify token in Settings. |
| Embedded Signup | Implemented, needs real Meta app config | Configure `META_*` variables and test with a real Meta app. |
| Webhook verification | Ready | Meta webhook verify should return the challenge when verify token matches. |
| Incoming message receive | Ready | Send a WhatsApp message; check Inbox and Settings webhook logs. |
| Outgoing WhatsApp send | Ready | Use Settings -> Test send. |
| AI settings | Ready | AI Assistant page saves tenant-scoped settings. |
| Knowledge Base training | Ready, worker required | Upload document, run worker, wait for `COMPLETED`. |
| AI test playground | Ready | AI Assistant -> test reply. |
| AI auto reply | Ready | Enable tenant AI and conversation AI, then send a customer WhatsApp message. |
| Usage limit check | Ready | Usage service reserves AI reply and WhatsApp message before sending. |
| Human handover | Ready | Use handover keywords or turn on Human handover in Inbox. |
| Inbox live update | Ready | Keep Inbox open while sending test messages. |

## Prerequisites

You need:

- A running NovaChat API, dashboard, worker, PostgreSQL, and Redis.
- A real OpenAI API key with available billing/credits.
- A real Meta Developer app with WhatsApp product.
- A real or test WhatsApp Business phone number.
- A public HTTPS API URL for webhooks. For local testing, use ngrok.
- A strong `WHATSAPP_TOKEN_ENCRYPTION_KEY`.

## Required Environment Variables

Backend `.env`:

```env
DATABASE_URL=postgresql://novachat:change_me_for_local_dev@127.0.0.1:55432/novachat?schema=public
REDIS_URL=redis://localhost:6380
JWT_SECRET=replace_with_at_least_32_characters_for_local_development
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

WHATSAPP_GRAPH_API_VERSION=v20.0
WHATSAPP_TOKEN_ENCRYPTION_KEY=replace_with_at_least_32_characters_for_token_encryption

META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_API_VERSION=v20.0
META_REDIRECT_URI=http://localhost:3000/settings
META_WEBHOOK_VERIFY_TOKEN=novachat_meta_verify_token
META_SYSTEM_USER_ACCESS_TOKEN=
META_EMBEDDED_SIGNUP_ENABLED=true

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Restart the backend after changing `.env`.

## Local Run Commands

Terminal 1:

```bash
docker compose up -d postgres redis
```

Terminal 2:

```bash
pnpm db:migrate
pnpm db:generate
pnpm dev:api
```

Terminal 3:

```bash
pnpm dev:worker
```

Terminal 4:

```bash
pnpm dev:dashboard
```

Terminal 5 for local webhooks:

```bash
ngrok http 4000
```

Your local dashboard is:

```text
http://localhost:3000
```

Your local API is:

```text
http://localhost:4000/api/v1
```

Your ngrok webhook URL is:

```text
https://YOUR_NGROK_DOMAIN/api/v1/webhooks/whatsapp
```

## Client Setup in NovaChat

### 1. Register the client tenant

1. Open `http://localhost:3000/register`.
2. Enter the client's owner name, email, password, and business/workspace name.
3. Submit the form.
4. NovaChat creates:
   - user
   - tenant/business
   - OWNER membership
   - starter plan/subscription
   - default tenant access token

### 2. Fill business profile

Go to AI Assistant.

Fill:

- Business name
- Business description
- Tone
- Supported languages
- Services
- Policies
- Fallback message
- Handover keywords

Example:

```text
Business name: ABC Fashion
Tone: friendly
Languages:
English
Sinhala

Services:
Women's clothing
Islandwide delivery
COD orders

Policies:
Delivery takes 2-4 working days.
Exchange is allowed within 7 days for unused items.
COD is available for selected areas.

Handover keywords:
human
agent
manager
complaint
refund
```

Click Save settings.

### 3. Add products/services/prices

Go to Products.

Add:

- Product name
- SKU
- Category
- Description
- Price
- Currency
- Stock quantity
- Image URL if available

For service businesses, also configure Services/Appointments where applicable.

### 4. Add FAQs and policies to Knowledge Base

Go to Knowledge Base.

Upload files such as:

- FAQ PDF
- product list CSV
- pricing document
- delivery policy
- return policy
- company profile
- service details

Then run:

```bash
pnpm dev:worker
```

Wait until documents show `COMPLETED`.

Use Test retrieval:

```text
What services do you offer?
What is your delivery policy?
What is the price of product X?
```

If it says no relevant knowledge found, your document may not contain that answer, embeddings may not be processed, or OpenAI embeddings may be failing.

## Meta / WhatsApp Setup

There are two supported methods.

## Method 1: Manual Setup

Use this when you have direct access to the client's Meta Developer app and token.

### In Meta Developer Console

1. Create or open a Meta Developer App.
2. Add the WhatsApp product.
3. Open WhatsApp API setup.
4. Copy:
   - Phone Number ID
   - WhatsApp Business Account ID / WABA ID
   - temporary or permanent access token
5. Open Webhooks.
6. Set callback URL:

```text
https://YOUR_API_DOMAIN/api/v1/webhooks/whatsapp
```

Local ngrok example:

```text
https://YOUR_NGROK_DOMAIN/api/v1/webhooks/whatsapp
```

7. Set verify token:

```text
novachat_meta_verify_token
```

Use the same value in `META_WEBHOOK_VERIFY_TOKEN` or in the manual account form.

8. Click Verify and Save.
9. Subscribe to WhatsApp message/status webhook fields.

Confirm exact field names in the live Meta Developer Console because Meta can update the UI.

### In NovaChat

1. Login as the client owner.
2. Go to Settings -> WhatsApp Integration.
3. Open Manual Setup.
4. Paste:
   - Business Account ID / WABA ID
   - Phone Number ID
   - Display phone number
   - Display name
   - Access token
   - Webhook verify token
5. Click Save account.
6. Status will be `PENDING` until webhook verification/health is complete.
7. Use Test send to send a WhatsApp message to your own phone.

## Method 2: Embedded Signup

Use this for a professional client self-onboarding flow.

### Platform admin setup first

In backend `.env`, configure:

```env
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_API_VERSION=v20.0
META_REDIRECT_URI=
META_WEBHOOK_VERIFY_TOKEN=
META_SYSTEM_USER_ACCESS_TOKEN=
META_EMBEDDED_SIGNUP_ENABLED=true
```

Restart the API.

### Client flow

1. Client logs into NovaChat.
2. Client goes to Settings -> WhatsApp Integration.
3. Client opens Connect Automatically.
4. Client clicks Connect WhatsApp.
5. Facebook/Meta login opens.
6. Client selects the business.
7. Client selects or creates WhatsApp Business Account.
8. Client selects/verifies phone number.
9. Client grants permission.
10. NovaChat receives the onboarding result.
11. NovaChat stores the access token encrypted.
12. NovaChat runs health check.
13. Client sends a test message.

Important: Meta's Embedded Signup returned payload can vary by Meta app configuration/API version. If callback says `phoneNumberId` or `wabaId` is missing, check the actual Meta SDK response and update the isolated dashboard mapping/backend callback payload.

## Enable AI Auto Reply

AI auto reply needs all of these:

1. WhatsApp account is connected and can send a test message.
2. Webhook is verified and recent webhook logs show `PROCESSED`.
3. AI Assistant settings are saved.
4. AI Assistant `isEnabled` is true.
5. Conversation `AI enabled` is true in Inbox.
6. Conversation `Human handover` is false.
7. Usage limits are not exceeded.
8. OpenAI key has quota/credits.
9. Knowledge documents are processed if you expect RAG answers.

## What Happens When a Customer Sends a Message

1. Customer sends WhatsApp message.
2. Meta calls:

```text
POST /api/v1/webhooks/whatsapp
```

3. NovaChat reads `phone_number_id`.
4. NovaChat finds `WhatsAppAccount`.
5. NovaChat gets `tenantId`.
6. NovaChat creates/updates Customer.
7. NovaChat creates/updates Conversation.
8. NovaChat stores inbound Message.
9. NovaChat emits realtime inbox events.
10. NovaChat checks chatbot flow.
11. If no flow handles it, NovaChat checks AI settings.
12. NovaChat checks usage limits.
13. NovaChat searches Knowledge Base chunks.
14. NovaChat builds prompt.
15. OpenAI generates answer.
16. NovaChat sends reply through official WhatsApp Cloud API.
17. NovaChat stores outbound Message.
18. NovaChat increments usage counters.

## Where To Check Logs

Dashboard:

- Settings -> WhatsApp Integration -> Recent webhook logs
- Settings -> WhatsApp Integration -> Last webhook received
- AI Assistant -> AI logs
- Knowledge Base -> document status and test retrieval
- Usage -> usage events and counters
- Inbox -> conversation thread and handover state

Backend terminal:

- API startup config logs
- Meta Embedded Signup config logs
- OpenAI request logs
- Webhook request logs
- Knowledge worker processing logs

Database tables:

- `WhatsAppAccount`
- `WhatsAppWebhookLog`
- `MetaConnectionLog`
- `Customer`
- `Conversation`
- `Message`
- `TenantAiSettings`
- `KnowledgeBaseDocument`
- `KnowledgeBaseChunk`
- `AiLog`
- `UsageEvent`

## Common Errors and Fixes

### `ERR_CONNECTION_REFUSED`

Backend is not running or wrong API URL.

Fix:

```bash
pnpm dev:api
```

Check dashboard uses:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

### Webhook verify fails

Usually verify token mismatch.

Fix:

- Check Meta verify token.
- Check `META_WEBHOOK_VERIFY_TOKEN`.
- Restart API.
- Use exact webhook URL `/api/v1/webhooks/whatsapp`.

### Incoming messages do not appear

Possible causes:

- Meta webhook not subscribed to messages.
- Wrong callback URL.
- Phone Number ID does not match saved account.
- Account is deleted/disabled.
- API is not public through ngrok/domain.

Check Settings -> Recent webhook logs.

### AI does not reply

Check:

- AI Assistant enabled.
- Conversation AI enabled.
- Human handover off.
- OpenAI key present.
- OpenAI credits available.
- Usage limit not reached.
- Backend logs for OpenAI error.
- AI logs table.

### Knowledge Base stays queued or processing

Worker is not running.

Fix:

```bash
pnpm dev:worker
```

### Knowledge search returns no result

Possible causes:

- Document status is not `COMPLETED`.
- Document does not contain the answer.
- Embeddings failed due to OpenAI key/quota.
- Query is too different from the document language.

### WhatsApp send fails

Possible causes:

- Token expired or invalid.
- Phone Number ID is wrong.
- Recipient phone is not allowed for test mode.
- WhatsApp conversation window/template rules apply.
- Usage limit reached.

Use Settings -> Test send and check backend logs.

## Real-World Manual Test Script

1. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

2. Apply migrations and generate Prisma:

```bash
pnpm db:migrate
pnpm db:generate
```

3. Start backend:

```bash
pnpm dev:api
```

4. Start worker:

```bash
pnpm dev:worker
```

5. Start dashboard:

```bash
pnpm dev:dashboard
```

6. Start ngrok:

```bash
ngrok http 4000
```

7. Copy webhook URL:

```text
https://YOUR_NGROK_DOMAIN/api/v1/webhooks/whatsapp
```

8. Paste webhook URL into Meta.
9. Paste verify token into Meta:

```text
novachat_meta_verify_token
```

10. Subscribe to WhatsApp message/status webhook fields.
11. Login/register client in NovaChat.
12. Fill AI Assistant business profile.
13. Add products/services.
14. Upload FAQ/product/policy document in Knowledge Base.
15. Wait until document status is `COMPLETED`.
16. Test retrieval in Knowledge Base.
17. Test AI reply in AI Assistant playground.
18. Connect WhatsApp manually or with Embedded Signup.
19. Send a test WhatsApp message from Settings.
20. Send a real customer message to the connected WhatsApp number.
21. Confirm Settings -> Recent webhook logs shows `PROCESSED`.
22. Confirm Inbox receives the message.
23. Confirm AI sends a reply.
24. Confirm AI logs show success.
25. Confirm Usage page counters update.
26. Send a handover keyword like `agent` or `human`.
27. Confirm conversation switches to Human handover.
28. Confirm AI stops replying until handover is disabled.

## Production Notes

- Use a real HTTPS API domain, not ngrok.
- Set `COOKIE_SECURE=true` behind HTTPS.
- Set `CORS_ORIGIN` to the production dashboard URL.
- Use permanent Meta system user tokens or Embedded Signup token flow approved for production.
- Complete Meta App Review / Tech Provider requirements.
- Monitor webhook logs and AI usage costs.
- Never expose access tokens to the frontend.
- Keep manual setup as support fallback.
