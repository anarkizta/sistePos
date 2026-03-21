import prisma from "@/lib/prisma";

export type SessionContext = {
  sessionId: number;
  userId: number;
  username: string;
  displayName: string;
  expiresAt: Date;
  storeId: number | null;
  terminalId: number | null;
  shiftId: number | null;
};

export class AuthError extends Error {
  status: number;
  requiredPermission?: string;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function getSessionContextById(sessionId: number): Promise<SessionContext> {
  const now = new Date();

  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      endedAt: null,
      expiresAt: { gt: now },
      user: { isActive: true },
    },
    select: {
      id: true,
      expiresAt: true,
      storeId: true,
      terminalId: true,
      shiftId: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  if (!session) {
    throw new AuthError("Sesion invalida o expirada", 401);
  }

  return {
    sessionId: session.id,
    userId: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    expiresAt: session.expiresAt,
    storeId: session.storeId,
    terminalId: session.terminalId,
    shiftId: session.shiftId,
  };
}

export async function getEffectivePermissionCodes(userId: number): Promise<Set<string>> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  });

  const base = new Set<string>();
  for (const r of roles) {
    for (const rp of r.role.rolePermissions) {
      base.add(rp.permission.code);
    }
  }

  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId },
    select: { effect: true, permission: { select: { code: true } } },
  });

  for (const o of overrides) {
    if (o.effect === "DENY") base.delete(o.permission.code);
  }
  for (const o of overrides) {
    if (o.effect === "ALLOW") base.add(o.permission.code);
  }

  return base;
}

export async function assertHasPermission(userId: number, permissionCode: string) {
  const perms = await getEffectivePermissionCodes(userId);
  if (!perms.has(permissionCode)) {
    const err = new AuthError("No autorizado", 403);
    err.requiredPermission = permissionCode;
    throw err;
  }
}

export async function assertHasPermissionOrAuthorization(
  userId: number,
  permissionCode: string,
  authorizationId?: number | null,
  usedAction?: string,
) {
  try {
    await assertHasPermission(userId, permissionCode);
    return;
  } catch (e) {
    if (!(e instanceof AuthError) || e.status !== 403) throw e;
  }

  if (!authorizationId || !Number.isFinite(authorizationId)) {
    const err = new AuthError("No autorizado", 403);
    err.requiredPermission = permissionCode;
    throw err;
  }

  const now = new Date();
  const auth = await prisma.actionAuthorization.findFirst({
    where: {
      id: authorizationId,
      requestedByUserId: userId,
      permissionCode,
      status: "APPROVED",
      authorizedAt: { not: null },
      usedAt: null,
    },
    select: { id: true },
  });

  if (!auth) {
    const err = new AuthError("No autorizado", 403);
    err.requiredPermission = permissionCode;
    throw err;
  }

  await prisma.actionAuthorization.update({
    where: { id: auth.id },
    data: { usedAt: now, usedAction: usedAction ?? null },
  });
}

