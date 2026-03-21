import prisma from "@/lib/prisma";

/** Ventana para contar intentos fallidos (mismo usuario/alias). */
export const LOCK_WINDOW_MINUTES = 10;
/** Intentos fallidos en ventana que disparan bloqueo. */
export const LOCK_MAX_FAILED_ATTEMPTS = 5;
/** Minutos de bloqueo en cuenta tras superar el limite (persistente en `user.lockedUntil`). */
export const LOCK_BAN_MINUTES = 15;

export function subtractMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export type LoginLockState = {
  locked: boolean;
  /** Bloqueo por cuenta (lockedUntil en BD). */
  accountLocked: boolean;
  lockedUntil: string | null;
  /** Bloqueo solo por ventana de intentos (sin fila user o antes de setear lockedUntil). */
  rateLimited: boolean;
  failedInWindow: number;
  maxAttempts: number;
  windowMinutes: number;
  attemptsRemaining: number;
  /** ISO: cuando caduca el bloqueo por cuenta. */
  accountUnlockAt: string | null;
  /** ISO: cuando la ventana de rate-limit dejaria de aplicar (aprox.: primer fallo + ventana). */
  rateLimitUnlockAt: string | null;
};

/**
 * Estado de bloqueo para un username (alias de login).
 * No revela si el usuario existe; para cuentas inexistentes solo aplica rate limit por username.
 */
export async function getLoginLockState(username: string): Promise<LoginLockState> {
  const trimmed = username.trim();
  const now = new Date();
  const windowStart = subtractMinutes(now, LOCK_WINDOW_MINUTES);

  const user = await prisma.user.findUnique({
    where: { username: trimmed },
    select: { id: true, lockedUntil: true },
  });

  const failures = await prisma.loginAttempt.findMany({
    where: {
      username: trimmed,
      success: false,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const failedInWindow = failures.length;
  const rateLimited = failedInWindow >= LOCK_MAX_FAILED_ATTEMPTS;

  let rateLimitUnlockAt: string | null = null;
  if (rateLimited && failures[0]) {
    rateLimitUnlockAt = addMinutes(failures[0].createdAt, LOCK_WINDOW_MINUTES).toISOString();
  }

  const accountLocked =
    !!user?.lockedUntil && user.lockedUntil.getTime() > now.getTime();

  const locked = accountLocked || rateLimited;

  const accountUnlockAt =
    user?.lockedUntil && user.lockedUntil.getTime() > now.getTime()
      ? user.lockedUntil.toISOString()
      : null;

  return {
    locked,
    accountLocked,
    lockedUntil: user?.lockedUntil?.toISOString() ?? null,
    rateLimited: rateLimited && !accountLocked,
    failedInWindow,
    maxAttempts: LOCK_MAX_FAILED_ATTEMPTS,
    windowMinutes: LOCK_WINDOW_MINUTES,
    attemptsRemaining: Math.max(0, LOCK_MAX_FAILED_ATTEMPTS - failedInWindow),
    accountUnlockAt,
    rateLimitUnlockAt,
  };
}

/** Tras un fallo de login con usuario conocido: si supera limite, fija lockedUntil. */
export async function applyAccountLockAfterFailures(userId: number, username: string) {
  const windowStart = subtractMinutes(new Date(), LOCK_WINDOW_MINUTES);
  const failed = await prisma.loginAttempt.count({
    where: {
      username,
      success: false,
      createdAt: { gte: windowStart },
    },
  });
  if (failed >= LOCK_MAX_FAILED_ATTEMPTS) {
    const until = addMinutes(new Date(), LOCK_BAN_MINUTES);
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: until },
    });
  }
}
