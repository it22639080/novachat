# Meta Embedded Signup for NovaChat AI

Meta Embedded Signup lets a tenant connect an official WhatsApp Business Platform account from inside NovaChat AI. The client does not manually paste a Phone Number ID, WABA ID, or access token. NovaChat receives the onboarding result, exchanges/validates it on the backend, encrypts the token, and stores the connected WhatsApp account under the tenant.

## Architecture

- Dashboard loads safe config from `GET /api/v1/meta/embedded-signup/config`.
- Dashboard opens the Facebook SDK Embedded Signup flow.
- Dashboard sends only the returned authorization/onboarding result to `POST /api/v1/meta/embedded-signup/callback`.
- API exchanges/validates the authorization result server-side and stores the access token encrypted.
- API runs `POST /api/v1/meta/embedded-signup/complete` to perform a health check and mark the account connected when ready.
- Existing webhook processing still routes by `phone_number_id`, resolves `WhatsAppAccount`, finds `tenantId`, stores the message, and triggers the same AI pipeline.
- Manual setup remains available under Settings -> WhatsApp Integration -> Manual Setup.

## Required Environment Variables

```env
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_API_VERSION=v20.0
META_REDIRECT_URI=http://localhost:3000/settings
META_WEBHOOK_VERIFY_TOKEN=
META_EMBEDDED_SIGNUP_ENABLED=true
```

Also keep the existing variables:

```env
WHATSAPP_TOKEN_ENCRYPTION_KEY=
WHATSAPP_GRAPH_API_VERSION=v20.0
```

`WHATSAPP_TOKEN_ENCRYPTION_KEY` must be at least 32 characters. Access tokens are never returned to the frontend after saving.

## Meta App Setup

1. Create or select a Meta Business app.
2. Add the WhatsApp product.
3. Configure Embedded Signup for the app and copy the Config ID into `META_CONFIG_ID`.
4. Configure OAuth/redirect settings using `META_REDIRECT_URI`.
5. Configure webhook callback URL:

```text
https://YOUR_API_DOMAIN.com/api/v1/webhooks/whatsapp
```

6. Use `META_WEBHOOK_VERIFY_TOKEN` as the verify token in Meta.
7. Subscribe to WhatsApp webhook fields for messages and statuses.
8. Complete required Meta permissions and App Review/Tech Provider steps before production use.

## Required Permissions

Exact permission names and onboarding requirements can change by Meta API version and Tech Provider status. Confirm current requirements in the Meta developer console before production. Typical WhatsApp Business Platform integrations need permissions for business management and WhatsApp account/message management.

## Local Testing with ngrok

1. Start local services:

```bash
docker compose up -d postgres redis
pnpm dev:api
pnpm dev:dashboard
```

2. Expose the API:

```bash
ngrok http 4000
```

3. Set Meta webhook callback URL to:

```text
https://YOUR_NGROK_DOMAIN.ngrok-free.app/api/v1/webhooks/whatsapp
```

4. Set `META_REDIRECT_URI` to your dashboard URL if Meta requires an HTTPS redirect for the signup flow.
5. Restart the API after changing `.env`.
6. Log in to NovaChat AI, go to Settings -> WhatsApp Integration -> Connect Automatically, and click Connect WhatsApp.

## Troubleshooting

- `META_EMBEDDED_SIGNUP_NOT_CONFIGURED`: one or more Meta environment variables are missing.
- `Meta did not return an access token`: confirm Config ID, redirect URI, app mode, and permissions.
- Callback missing `phoneNumberId` or `wabaId`: confirm the Embedded Signup result shape for the current Meta API version and update the isolated Meta SDK payload mapping in the dashboard if needed.
- Health check needs review: confirm token permissions, phone number ID, WABA subscription, webhook verify token, and Meta App Review state.
- Webhook not received: verify Meta callback URL, verify token, subscribed fields, and public API tunnel/domain.

## Production Checklist

- Use HTTPS for API and dashboard.
- Configure production `META_REDIRECT_URI`.
- Use a strong `WHATSAPP_TOKEN_ENCRYPTION_KEY`.
- Keep `META_APP_SECRET` server-only.
- Complete Meta App Review and Tech Provider requirements.
- Confirm webhook signature validation strategy before public launch.
- Monitor `MetaConnectionLog` and `WhatsAppWebhookLog`.
- Keep manual setup available for support fallback.

## Manual vs Embedded Signup

Manual setup is an advanced fallback where an operator pastes WABA ID, Phone Number ID, access token, and webhook verify token. Embedded Signup is the preferred client flow because Meta handles business/phone selection and NovaChat saves the resulting credentials securely on the backend.
