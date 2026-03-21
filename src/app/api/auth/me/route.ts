import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AuthError, getEffectivePermissionCodes, getSessionContextById } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ session: null, user: null }, { status: 200 });
    }

    const session = await getSessionContextById(sessionId);
    const permissions = await getEffectivePermissionCodes(session.userId);

    let shift: {
      id: number;
      status: string;
      openedAt: string;
      openingCashAmount: string;
      store: { code: string; name: string };
      terminal: { code: string; name: string };
    } | null = null;

    if (session.shiftId) {
      const sh = await prisma.shift.findUnique({
        where: { id: session.shiftId },
        include: {
          store: { select: { code: true, name: true } },
          terminal: { select: { code: true, name: true } },
        },
      });
      if (sh && sh.status === "OPEN") {
        shift = {
          id: sh.id,
          status: sh.status,
          openedAt: sh.openedAt.toISOString(),
          openingCashAmount: String(sh.openingCashAmount),
          store: sh.store,
          terminal: sh.terminal,
        };
      }
    }

    return NextResponse.json({
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
        storeId: session.storeId,
        terminalId: session.terminalId,
        shiftId: session.shiftId,
        shift,
      },
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
      },
      permissions: Array.from(permissions).sort(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ session: null, user: null }, { status: 200 });
    }
    console.error("Error en GET /api/auth/me:", error);
    return NextResponse.json({ error: "Error al obtener sesion" }, { status: 500 });
  }
}
