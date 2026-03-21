import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { createAuditEvent } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const now = new Date();

    if (Number.isFinite(sessionId)) {
      const row = await prisma.authSession.findFirst({
        where: {
          id: sessionId,
          endedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, userId: true },
      });

      if (row) {
        await prisma.authSession.update({
          where: { id: row.id },
          data: { endedAt: now, endReason: "LOGOUT" },
        });

        await createAuditEvent({
          actorUserId: row.userId,
          action: "sesion_cerrar",
          entityType: "auth_session",
          entityId: row.id,
          message: `Cierre de sesion voluntario sessionId=${row.id}`,
          dataJson: { sessionId: row.id } as Prisma.InputJsonValue,
        });
      }
    }

    cookieStore.set("sp_session_id", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en POST /api/auth/logout:", error);
    return NextResponse.json({ error: "Error al cerrar sesion" }, { status: 500 });
  }
}
