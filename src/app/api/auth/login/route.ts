import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const MAX_SESSION_HOURS = 10;
const LOCK_WINDOW_MINUTES = 10;
const LOCK_MAX_FAILED_ATTEMPTS = 5;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function subtractMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      credential?: string; // pin o password
      storeId?: number | null;
      terminalId?: number | null;
      ip?: string | null;
    };

    const username = String(body?.username ?? "").trim();
    const credential = String(body?.credential ?? "");

    if (!username || !credential) {
      return NextResponse.json(
        { error: "username y credential son obligatorios" },
        { status: 400 },
      );
    }

    const lockWindowStart = subtractMinutes(new Date(), LOCK_WINDOW_MINUTES);

    const failedAttempts = await prisma.loginAttempt.count({
      where: {
        username,
        success: false,
        createdAt: { gte: lockWindowStart },
      },
    });

    if (failedAttempts >= LOCK_MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        {
          error: `Usuario temporalmente bloqueado por demasiados intentos. Intenta de nuevo en ${LOCK_WINDOW_MINUTES} minutos.`,
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
      },
    });

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

      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
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

      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
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

      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const now = new Date();
    const expiresAt = addHours(now, MAX_SESSION_HOURS);

    const session = await prisma.$transaction(async (tx) => {
      // Cerrar cualquier sesion activa previa del usuario (una sola sesion activa)
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
        data: { lastLoginAt: now },
      });

      return created;
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

