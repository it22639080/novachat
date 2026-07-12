# NovaChat AI Security Checklist

## API Boundary

- Helmet is enabled with defensive headers and a restrictive API content security policy.
- CORS uses an explicit allow-list from `CORS_ORIGIN`. Use comma-separated origins for production dashboards.
- `x-powered-by` is disabled.
- JSON body size is controlled by `REQUEST_JSON_LIMIT`; URL encoded payloads are capped separately.
- API rate limiting is enabled for all API requests and stricter auth endpoints.
- Cookie-authenticated unsafe requests require `x-novachat-csrf: same-origin`.
- SQL injection risk is reduced by Prisma parameterized queries. Raw SQL must stay reviewed and tenant-scoped.
- Request payloads reject prototype-pollution keys: `__proto__`, `prototype`, and `constructor`.

## Authentication And Sessions

- Access and refresh tokens are stored in httpOnly cookies.
- Refresh tokens are stored as SHA-256 hashes only.
- Refresh token rotation is required on `/auth/refresh`.
- Production cookies must use `COOKIE_SECURE=true`.
- Password policy requires at least 10 characters, uppercase, lowercase, number, and symbol.
- Login/register endpoints have stricter rate limits.

## Tenant Isolation

- Every tenant-owned table must include `tenantId`.
- Every dashboard API must use `authenticate` and `tenantContext`.
- Every repository/service query must filter by `tenantId`.
- Super Admin APIs must use `authenticate` and `requireSuperAdmin`.
- Tenant isolation tests must cover positive access and cross-tenant denial.

## Credentials And Secrets

- WhatsApp access tokens are encrypted before storage.
- API secrets must never be returned to frontend responses.
- Logs redact tokens, cookies, API keys, passwords, and secrets.
- `.env` files must not be committed.
- Rotate `JWT_SECRET` and `WHATSAPP_TOKEN_ENCRYPTION_KEY` before production launch.

## Webhooks

- WhatsApp webhook verification token is validated.
- Signature validation is still a production hardening item before public launch.
- Webhook raw payloads may be stored for debugging but must avoid exposing credentials.
- Webhook routes bypass CSRF because they are external machine-to-machine calls.

## File Uploads

- Knowledge uploads are tenant scoped.
- Supported file types are limited by API validation.
- File size must stay under `REQUEST_JSON_LIMIT`.
- Malware scanning is a placeholder requirement before accepting untrusted customer uploads at scale.
- Uploaded text extraction failures should mark documents as failed, not block the worker.

## Backups

- Enable daily PostgreSQL backups with point-in-time recovery where available.
- Test restore into a separate staging database monthly.
- Back up Supabase/S3 object storage metadata and bucket policies.
- Redis queues should be treated as recoverable runtime state; durable business data belongs in PostgreSQL.
