import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  getLoginLockState,
  applyAccountLockAfterFailures,
  LOCK_MAX_FAILED_ATTEMPTS,
  LOCK_WINDOW_MINUTES,
  LOCK_BAN_MINUTES,
} from "@/lib/login-lockout";
import { createAuditEvent } from "@/lib/audit";
import { Prisma } from "@prisma/client";

const MAX_SESSION_HOURS = 10;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function buildLockPayload(state: Awaited<ReturnType<typeof getLoginLockState>>) {
  return {
    locked: true,
    accountUnlockAt: state.accountUnlockAt,
    rateLimitUnlockAt: state.rateLimitUnlockAt,
    failedInWindow: state.failedInWindow,
    maxAttempts: state.maxAttempts,
    windowMinutes: state.windowMinutes,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      credential?: string;
      storeId?: number | null;
      terminalId?: number | null;
      ip?: string | null;
    };

    const username = String(body?.username ?? "").trim();
    const credential = String(body?.credential ?? "");

    if (!username || !credential) {
      return NextResponse.json(
        {
          error: "Debes indicar el usuario y el PIN o clave.",
          code: "MISSING_FIELDS",
        },
        { status: 400 },
      );
    }

    const preState = await getLoginLockState(username);
    if (preState.accountLocked) {
      return NextResponse.json(
        {
          error: `Cuenta bloqueada por seguridad tras varios intentos fallidos. Vuelve a intentar despues de las ${preState.accountUnlockAt ? new Date(preState.accountUnlockAt).toLocaleString("es-CL") : "indicadas"}. Si persiste, contacta al administrador.`,
          code: "ACCOUNT_LOCKED",
          ...buildLockPayload(preState),
        },
        { status: 429 },
      );
    }
    if (preState.failedInWindow >= LOCK_MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos en los ultimos ${LOCK_WINDOW_MINUTES} minutos. Espera unos minutos o usa otro equipo si fue un error. Limite: ${LOCK_MAX_FAILED_ATTEMPTS} intentos.`,
          code: "RATE_LIMITED",
          ...buildLockPayload(preState),
        },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        credentialType: true,
        pinHash: true,
        passwordHash: true,
        isActive: true,
        lockedUntil: true,
      },
    });

    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
      return NextResponse.json(
        {
          error: `Cuenta bloqueada temporalmente. Intenta de nuevo despues de ${user.lockedUntil.toLocaleString("es-CL")}.`,
          code: "ACCOUNT_LOCKED",
          accountUnlockAt: user.lockedUntil.toISOString(),
        },
        { status: 429 },
      );
    }

    if (!user || !user.isActive) {
      await prisma.loginAttempt.create({
        data: {
          username,
          userId: user?.id ?? null,
          success: false,
          reason: !user ? "user_not_found" : "user_inactive",
          ip: body?.ip ? String(body.ip).slice(0, 64) : null,
          terminalId: body?.terminalId ?? null,
        },
      });

      const after = await getLoginLockState(username);
      return NextResponse.json(
        {
          error: "Usuario o PIN/clave incorrectos.",
          code: "INVALID_CREDENTIALS",
          attemptsRemaining: after.attemptsRemaining,
          failedInWindow: after.failedInWindow,
          maxAttempts: LOCK_MAX_FAILED_ATTEMPTS,
        },
        { status: 401 },
      );
    }

    const hash = user.credentialType === "PIN" ? user.pinHash : user.passwordHash;
    if (!hash) {
      await prisma.loginAttempt.create({
        data: {
          username,
          userId: user.id,
          success: false,
          reason: "credential_not_set",
          ip: body?.ip ? String(body.ip).slice(0, 64) : null,
          terminalId: body?.terminalId ?? null,
        },
      });
      await applyAccountLockAfterFailures(user.id, username);

      const after = await getLoginLockState(username);
      return NextResponse.json(
        {
          error: "Este usuario no tiene credencial configurada. Contacta al administrador.",
          code: "CREDENTIAL_NOT_SET",
          attemptsRemaining: after.attemptsRemaining,
        },
        { status: 401 },
      );
    }

    const ok = await bcrypt.compare(credential, hash);

    if (!ok) {
      await prisma.loginAttempt.create({
        data: {
          username,
          userId: user.id,
          success: false,
          reason: "bad_credentials",
          ip: body?.ip ? String(body.ip).slice(0, 64) : null,
          terminalId: body?.terminalId ?? null,
        },
      });
      await applyAccountLockAfterFailures(user.id, username);

      const after = await getLoginLockState(username);
      const nearLimit = after.failedInWindow >= LOCK_MAX_FAILED_ATTEMPTS - 1;

      return NextResponse.json(
        {
          error: nearLimit
            ? `PIN o clave incorrectos. Te queda ${after.attemptsRemaining} intento antes de un bloqueo de ${LOCK_BAN_MINUTES} minutos en esta cuenta.`
            : "PIN o clave incorrectos.",
          code: "INVALID_CREDENTIALS",
          attemptsRemaining: after.attemptsRemaining,
          failedInWindow: after.failedInWindow,
          maxAttempts: LOCK_MAX_FAILED_ATTEMPTS,
          accountLocked: after.accountLocked,
          accountUnlockAt: after.accountUnlockAt,
        },
        { status: 401 },
      );
    }

    const expiresAt = addHours(now, MAX_SESSION_HOURS);

    const session = await prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: {
          userId: user.id,
          endedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          endedAt: now,
          endReason: "FORCED",
        },
      });

      const created = await tx.authSession.create({
        data: {
          userId: user.id,
          storeId: body?.storeId ?? null,
          terminalId: body?.terminalId ?? null,
          startedAt: now,
          expiresAt,
        },
      });

      await tx.loginAttempt.create({
        data: {
          username,
          userId: user.id,
          success: true,
          reason: null,
          ip: body?.ip ? String(body.ip).slice(0, 64) : null,
          terminalId: body?.terminalId ?? null,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now, lockedUntil: null },
      });

      return created;
    });

    await createAuditEvent({
      actorUserId: user.id,
      action: "sesion_iniciar",
      entityType: "auth_session",
      entityId: session.id,
      message: `Inicio de sesion: ${user.username}`,
      dataJson: {
        sessionId: session.id,
        storeId: session.storeId,
        terminalId: session.terminalId,
        expiresAt: session.expiresAt.toISOString(),
      } as Prisma.InputJsonValue,
    });

    const cookieStore = await cookies();
    cookieStore.set("sp_session_id", String(session.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_SESSION_HOURS * 60 * 60,
    });

    return NextResponse.json({
      session: {
        id: session.id,
        userId: session.userId,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        storeId: session.storeId,
        terminalId: session.terminalId,
      },
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/auth/login:", error);
    const message = error instanceof Error ? error.message : "Error en login";
    return NextResponse.json({ error: message, code: "SERVER_ERROR" }, { status: 500 });
  }
}
