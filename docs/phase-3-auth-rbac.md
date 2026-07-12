# Phase 3: Authentication, RBAC, and Tenant Access

## Scope

This phase implements the secure SaaS auth and tenant access foundation:

- Business owner registration.
- Login/logout.
- Refresh token rotation.
- Forgot/reset password.
- Email verification placeholder token creation.
- Tenant selection after login.
- Multi-tenant user membership.
- RBAC and permission middleware.
- Team invitation and member role management.
- Audit logs for registration, login, tenant switching, invites, role changes, and removals.

## Token Strategy

The API uses httpOnly cookies:

- `novachat_access_token`: short-lived JWT.
- `novachat_refresh_token`: opaque random token.

The refresh token is never stored raw. The database stores only a SHA-256 hash in `RefreshToken.tokenHash`. Refresh rotates by revoking the old token and issuing a new one.

httpOnly cookies are used instead of localStorage because browser scripts cannot read them. This reduces token theft risk from XSS. Cookies use `sameSite: "lax"` and `secure` in production through `COOKIE_SECURE=true`.

## Password Hashing

Passwords use bcrypt-compatible hashes through `bcryptjs`. Native `bcrypt` could not build reliably in this Windows/Node 24 sandbox because the prebuilt binary download was blocked and node-gyp could not find Python. `bcryptjs` keeps the bcrypt algorithm without native build requirements.

## Tenant Isolation

Tenant access is enforced in layers:

1. `authenticate` validates the access token and attaches `req.user`.
2. `tenantContext` verifies the selected tenant against active membership.
3. `requireRole` checks tenant role hierarchy.
4. `requirePermission` checks role permissions from `RolePermission`.

API handlers must use `req.tenant.id` for tenant-owned data queries. Client-provided tenant ids alone are not trusted.

## Frontend Auth

The dashboard includes:

- Register page.
- Login page.
- Forgot password page.
- Reset password page.
- Tenant selector page.
- Auth provider.
- API client with refresh-on-401.
- Protected dashboard shell.
- Logout flow.
- Role/permission UI guard component.

## Manual Test Checklist

1. Register a business owner and tenant.
2. Confirm cookies are set as httpOnly.
3. Login with the owner.
4. Refresh the session with `/api/auth/refresh`.
5. Switch tenant from the selector.
6. Invite staff as `ADMIN`, `MANAGER`, `AGENT`, or `VIEWER`.
7. Update a member role as owner/admin.
8. Verify owner cannot be removed through team removal.
9. Verify users cannot switch to tenants where they have no membership.
10. Verify team endpoints reject users without `members.manage`.
