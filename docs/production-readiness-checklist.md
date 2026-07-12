# NovaChat AI Production Readiness Checklist

## Environment

- `NODE_ENV=production`
- `COOKIE_SECURE=true`
- `CSRF_PROTECTION_ENABLED=true`
- `TRUST_PROXY=true` behind Railway, Render, Coolify, Nginx, or a load balancer.
- `CORS_ORIGIN` contains only production dashboard and super-admin origins.
- `JWT_SECRET` is unique, random, and at least 32 characters.
- `WHATSAPP_TOKEN_ENCRYPTION_KEY` is unique, random, and at least 32 characters.
- OpenAI/Gemini/WhatsApp credentials are stored only in deployment secrets.

## Database

- Prisma migrations applied.
- pgvector extension enabled.
- Daily backups enabled.
- Restore procedure tested.
- Database connection limits sized for API, workers, and migrations.
- Tenant isolation queries reviewed for new features before release.

## Redis And Queues

- Redis version is 5+ for BullMQ.
- Workers run separately from API web dynos where possible.
- Failed jobs are observable.
- Queue retry policies are documented.
- Monthly and daily usage reset jobs are scheduled once per environment.

## API Security

- Helmet, CORS allow-list, CSRF guard, request size limits, and rate limiting enabled.
- Webhook signature validation completed before public Meta webhook rollout.
- Logs redact cookies, tokens, secrets, API keys, and passwords.
- Super Admin routes verified with business-user denial tests.
- API key creation/revocation flow reviewed.

## Frontend

- Dashboard uses HTTPS API URL.
- Super Admin app is deployed separately or access-restricted.
- All cookie-authenticated write requests send `x-novachat-csrf: same-origin`.
- Error states avoid exposing secrets/provider raw credentials.

## AI And WhatsApp

- OpenAI billing/quota configured.
- Tenant usage limits configured for every customer.
- AI fallback/human handover verified.
- WhatsApp templates approved before campaigns.
- Customer opt-in and opt-out behavior verified.

## Storage And Uploads

- Storage bucket is private by default.
- Signed URLs expire quickly.
- File type and size limits are enforced.
- Malware scanning provider selected before accepting untrusted production uploads at scale.

## Observability

- Structured logs shipped to a central provider.
- Health checks enabled for API and worker.
- Error alerts configured.
- Usage/cost alerts configured at 80%, 90%, and 100%.
- Audit logs retained for important actions.

## Release Gate

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @novachat/database prisma:validate`
- Manual smoke test: login, tenant switch, inbox, simulator message, AI test reply, knowledge retrieval, billing usage, super-admin overview.
