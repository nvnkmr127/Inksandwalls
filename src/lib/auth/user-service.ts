import { Role, UserStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { recordAuditEvent, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "../audit";

export const VALID_ROLES = [
  Role.GUEST,
  Role.CUSTOMER,
  Role.STORE_ADMIN,
  Role.SUPER_ADMIN,
] as const;

export type AllowedRole = (typeof VALID_ROLES)[number];

/**
 * Validate if a string represents a valid application Role.
 */
export function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role);
}

/**
 * Sanitize client-supplied input payloads to prevent privilege escalation.
 * Removes role, status, id, and timestamp fields supplied by untrusted clients.
 */
export function sanitizeClientUserInput<T extends Record<string, unknown>>(input: T): Omit<T, "role" | "status" | "id" | "createdAt" | "updatedAt"> {
  const sanitized = { ...input };
  delete sanitized.role;
  delete sanitized.status;
  delete sanitized.id;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  return sanitized;
}

export interface UserCreateOrUpdateInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  image?: string | null;
  role?: Role;
  status?: UserStatus;
}

/**
 * Server-controlled utility to find or create a user by phone number with linked Customer domain entity and transactional audit logging.
 */
export async function findOrCreateUserByPhone(phone: string, extraInput?: UserCreateOrUpdateInput) {
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    include: { customer: true },
  });

  if (existingUser) {
    if (!existingUser.customer) {
      await prisma.customer.create({
        data: { userId: existingUser.id },
      });
    }
    return existingUser;
  }

  return prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        phone,
        email: extraInput?.email || null,
        name: extraInput?.name || null,
        image: extraInput?.image || null,
        role: extraInput?.role || Role.CUSTOMER,
        status: extraInput?.status || UserStatus.ACTIVE,
        customer: {
          create: {},
        },
      },
      include: { customer: true },
    });

    await recordAuditEvent(
      {
        actorUserId: newUser.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: newUser.id,
        metadata: { phone: newUser.phone, role: newUser.role, status: newUser.status },
      },
      tx
    );

    return newUser;
  });
}

/**
 * Server-controlled utility to find or create a user by email with linked Customer domain entity and transactional audit logging.
 */
export async function findOrCreateUserByEmail(email: string, extraInput?: UserCreateOrUpdateInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (existingUser) {
    if (!existingUser.customer) {
      await prisma.customer.create({
        data: { userId: existingUser.id },
      });
    }
    return existingUser;
  }

  return prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        phone: extraInput?.phone || null,
        name: extraInput?.name || null,
        image: extraInput?.image || null,
        role: extraInput?.role || Role.CUSTOMER,
        status: extraInput?.status || UserStatus.ACTIVE,
        customer: {
          create: {},
        },
      },
      include: { customer: true },
    });

    await recordAuditEvent(
      {
        actorUserId: newUser.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: newUser.id,
        metadata: { email: newUser.email, role: newUser.role, status: newUser.status },
      },
      tx
    );

    return newUser;
  });
}

/**
 * Change a user's role with transactional audit record.
 */
export async function updateUserRole(targetUserId: string, newRole: Role, actorUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!existing) throw new Error("User not found");
    const previousRole = existing.role;

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await recordAuditEvent(
      {
        actorUserId: actorUserId || null,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: targetUserId,
        metadata: { previousRole, newRole },
      },
      tx
    );

    return updated;
  });
}

/**
 * Change a user's status (ACTIVE / SUSPENDED) with transactional audit record.
 */
export async function updateUserStatus(targetUserId: string, newStatus: UserStatus, actorUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!existing) throw new Error("User not found");
    const previousStatus = existing.status;
    const action = newStatus === UserStatus.SUSPENDED ? AUDIT_ACTIONS.USER_SUSPENDED : AUDIT_ACTIONS.USER_REACTIVATED;

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { status: newStatus },
    });

    await recordAuditEvent(
      {
        actorUserId: actorUserId || null,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: targetUserId,
        metadata: { previousStatus, newStatus },
      },
      tx
    );

    return updated;
  });
}
