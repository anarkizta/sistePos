import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { AuthError, assertHasPermission, getSessionContextById } from "@/lib/auth";
import { assertStoreAccess, assertTerminalBelongsToStore } from "@/lib/store-access";

/** Turno abierto actual en una caja (si existe). */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "turno_abrir");

    const { searchParams } = new URL(request.url);
    const storeId = Number(searchParams.get("storeId") ?? "");
    const terminalId = Number(searchParams.get("terminalId") ?? "");
    if (!Number.isFinite(storeId) || !Number.isFinite(terminalId)) {
      return NextResponse.json({ error: "storeId y terminalId son obligatorios" }, { status: 400 });
    }

    await assertStoreAccess(session.userId, storeId);
    await assertTerminalBelongsToStore(terminalId, storeId);

    const shift = await prisma.shift.findFirst({
      where: { storeId, terminalId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        terminal: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Error en GET /api/turnos/actual:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al consultar turno" }, { status: 500 });
  }
}
