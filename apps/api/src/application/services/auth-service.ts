import { prisma } from "@novachat/database";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SwitchTenantInput,
  VerifyEmailInput
} from "@novachat/shared-types";
import { env } from "../../config/env.js";
import { PasswordHasher } from "../../infrastructure/auth/password-hasher.js";
import { TokenService } from "../../infrastructure/auth/token-service.js";
import { conflict, forbidden, notFound, unauthorized } from "../../shared/errors/app-error.js";
import { slugify } from "../../shared/strings/slugify.js";
import { PermissionService } from "./permission-service.js";

const passwordHasher = new PasswordHasher();
const tokenService = new TokenService();
const permissionService = new PermissionService();
const visibleTenantStatuses = [
  "ACTIVE",
  "APPROVED",
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_ADMIN_APPROVAL",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED"
] as const;
const selectableTenantStatuses = ["ACTIVE", "APPROVED"] as const;

type RequestMeta = {
  ipAddress: string | undefined;
  userAgent: string | undefined;
};

function auditMeta(meta: RequestMeta) {
  return {
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin
  };
}

async function createSession(userId: string, meta: RequestMeta) {
  const refreshToken = tokenService.createRefreshToken();
  const tokenHash = tokenService.hashToken(refreshToken);
  const expiresAt = addDays(new Date(), env.REFRESH_TOKEN_EXPIRES_IN_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ...auditMeta(meta)
    }
  });

  return refreshToken;
}

export class AuthService {
  private async createAvailableTenantSlug(baseSlug: string) {
    let candidate = baseSlug;
    let suffix = 2;

    while (
      await prisma.tenant.findUnique({
        where: { slug: candidate },
        select: { id: true }
      })
    ) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  async register(input: RegisterInput, meta: RequestMeta) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true }
    });

    if (existingUser) {
      throw conflict("An account with this email already exists");
    }

    const passwordHash = await passwordHasher.hash(input.password);
    const tenantSlugBase = input.tenantSlug ?? slugify(input.tenantName);
    const tenantSlug = await this.createAvailableTenantSlug(tenantSlugBase || `tenant-${Date.now()}`);

    const emailVerificationToken = tokenService.createOpaqueToken();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash
        }
      });

      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: tenantSlug,
          status: "PENDING_EMAIL_VERIFICATION",
          approvalStatusChangedAt: new Date()
        }
      });

      const plan = await tx.plan.upsert({
        where: { code: "starter" },
        update: {},
        create: {
          code: "starter",
          name: "Starter",
          description: "Default starter plan",
          priceMonthly: "0",
          limits: {
            seats: 3,
            monthlyMessages: 1000,
            aiResponses: 100
          }
        }
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: "TRIALING",
          currentPeriodStart: new Date(),
          currentPeriodEnd: addDays(new Date(), 14),
          trialEndsAt: addDays(new Date(), 14)
        }
      });

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE"
        }
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenService.hashToken(emailVerificationToken),
          expiresAt: addDays(new Date(), 1)
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: user.id,
          action: "auth.register",
          entityType: "Tenant",
          entityId: tenant.id,
          ...auditMeta(meta)
        }
      });

      await tx.notification.create({
        data: {
          tenantId: tenant.id,
          title: "New account registration",
          body: `${input.tenantName} registered and is waiting for email verification.`,
          metadata: {
            type: "NEW_REGISTRATION",
            tenantId: tenant.id,
            userId: user.id
          }
        }
      });

      return { user, tenant };
    });

    const authUser = toAuthUser(result.user);
    const permissions = await permissionService.permissionsForRole("OWNER");
    const accessToken = tokenService.createAccessToken({
      user: authUser,
      tenant: { id: result.tenant.id, role: "OWNER", permissions }
    });
    const refreshToken = await createSession(result.user.id, meta);

    return {
      user: authUser,
      activeTenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        status: result.tenant.status,
        role: "OWNER",
        permissions
      },
      emailVerificationRequired: true,
      accountStatus: result.tenant.status,
      verificationToken: env.NODE_ENV === "production" ? null : emailVerificationToken,
      accessToken,
      refreshToken
    };
  }

  async verifyEmail(input: VerifyEmailInput, meta: RequestMeta) {
    const tokenHash = tokenService.hashToken(input.token);
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true
          }
        }
      }
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date()) {
      throw unauthorized("Invalid or expired email verification token");
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: now }
      });
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: now }
      });

      const tenants = await tx.tenant.findMany({
        where: {
          members: {
            some: {
              userId: verificationToken.userId,
              role: "OWNER",
              deletedAt: null
            }
          },
          status: "PENDING_EMAIL_VERIFICATION",
          deletedAt: null
        },
        select: { id: true, name: true, slug: true }
      });

      for (const tenant of tenants) {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            status: "PENDING_ADMIN_APPROVAL",
            approvalStatusChangedAt: now
          }
        });
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: verificationToken.userId,
            action: "auth.email_verified",
            entityType: "Tenant",
            entityId: tenant.id,
            ...auditMeta(meta)
          }
        });
        await tx.notification.create({
          data: {
            tenantId: tenant.id,
            title: "Account pending approval",
            body: `${tenant.name} verified email and is waiting for super admin approval.`,
            metadata: {
              type: "PENDING_ACCOUNT_APPROVAL",
              tenantId: tenant.id,
              userId: verificationToken.userId
            }
          }
        });
      }

      return tenants;
    });

    return {
      user: toAuthUser(verificationToken.user),
      tenants: result.map((tenant) => ({
        ...tenant,
        status: "PENDING_ADMIN_APPROVAL"
      }))
    };
  }

  async login(input: LoginInput, meta: RequestMeta) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isSuperAdmin: true,
        deletedAt: true
      }
    });

    if (!user || user.deletedAt || !user.passwordHash) {
      throw unauthorized("Invalid email or password");
    }

    const validPassword = await passwordHasher.verify(input.password, user.passwordHash);

    if (!validPassword) {
      throw unauthorized("Invalid email or password");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        ...auditMeta(meta)
      }
    });

    const authUser = toAuthUser(user);
    const accessToken = tokenService.createAccessToken({ user: authUser });
    const refreshToken = await createSession(user.id, meta);

    return {
      user: authUser,
      tenants: await this.listTenants(user.id),
      accessToken,
      refreshToken
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return;
    }

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: tokenService.hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) {
      throw unauthorized("Refresh token is required");
    }

    const tokenHash = tokenService.hashToken(refreshToken);
    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
            deletedAt: true
          }
        }
      }
    });

    if (
      !existingToken ||
      existingToken.revokedAt ||
      existingToken.expiresAt <= new Date() ||
      existingToken.user.deletedAt
    ) {
      throw unauthorized("Invalid or expired refresh token");
    }

    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() }
    });

    const authUser = toAuthUser(existingToken.user);
    const nextRefreshToken = await createSession(existingToken.userId, meta);
    const accessToken = tokenService.createAccessToken({ user: authUser });

    return {
      user: authUser,
      accessToken,
      refreshToken: nextRefreshToken
    };
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true }
    });

    if (!user) {
      return { resetToken: null };
    }

    const resetToken = tokenService.createOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenService.hashToken(resetToken),
        expiresAt: addMinutes(new Date(), env.PASSWORD_RESET_EXPIRES_IN_MINUTES)
      }
    });

    return { resetToken: env.NODE_ENV === "production" ? null : resetToken };
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = tokenService.hashToken(input.token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw unauthorized("Invalid or expired password reset token");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: await passwordHasher.hash(input.password) }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true
      }
    });

    if (!user) {
      throw notFound("User not found");
    }

    return {
      user: toAuthUser(user),
      tenants: await this.listTenants(user.id)
    };
  }

  async switchTenant(userId: string, input: SwitchTenantInput, meta: RequestMeta) {
    const member = await prisma.tenantMember.findFirst({
      where: {
        userId,
        tenantId: input.tenantId,
        status: "ACTIVE",
        deletedAt: null,
        tenant: {
          status: { in: [...selectableTenantStatuses] },
          deletedAt: null
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      }
    });

    if (!member) {
      throw forbidden("Tenant access denied");
    }

    const permissions = await permissionService.permissionsForRole(member.role);
    await prisma.auditLog.create({
      data: {
        tenantId: member.tenantId,
        actorUserId: userId,
        action: "tenant.switch",
        entityType: "Tenant",
        entityId: member.tenantId,
        ...auditMeta(meta)
      }
    });

    const authUser = toAuthUser(member.user);

    return {
      user: authUser,
      activeTenant: {
        ...member.tenant,
        role: member.role,
        permissions
      },
      accessToken: tokenService.createAccessToken({
        user: authUser,
        tenant: {
          id: member.tenantId,
          role: member.role,
          permissions
        }
      })
    };
  }

  async listTenants(userId: string) {
    const memberships = await prisma.tenantMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        deletedAt: null,
        tenant: {
          status: { in: [...visibleTenantStatuses] },
          deletedAt: null
        }
      },
      select: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            createdAt: true,
            subscriptions: {
              where: { deletedAt: null },
              select: {
                plan: { select: { code: true } }
              },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      },
      orderBy: {
        tenant: { name: "asc" }
      }
    });

    return Promise.all(
      memberships.map(async (membership) => ({
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
        status: membership.tenant.status,
        plan: membership.tenant.subscriptions[0]?.plan.code ?? "free",
        role: membership.role,
        permissions: await permissionService.permissionsForRole(membership.role),
        createdAt: membership.tenant.createdAt.toISOString()
      }))
    );
  }
}
