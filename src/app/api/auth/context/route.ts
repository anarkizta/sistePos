import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AuthError, getSessionContextById } from "@/lib/auth";
import { assertStoreAccess, assertTerminalBelongsToStore } from "@/lib/store-access";
import { createAuditEvent } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/**
 * Actualiza sucursal/caja de la sesion actual y enlaza el turno OPEN del usuario en esa caja (si existe).
 */
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);

    const body = (await request.json()) as { storeId?: number; terminalId?: number };
    const storeId = Number(body?.storeId);
    const terminalId = Number(body?.terminalId);
    if (!Number.isFinite(storeId) || !Number.isFinite(terminalId)) {
      return NextResponse.json({ error: "storeId y terminalId son obligatorios" }, { status: 400 });
    }

    await assertStoreAccess(session.userId, storeId);
    await assertTerminalBelongsToStore(terminalId, storeId);

    const openShift = await prisma.shift.findFirst({
      where: { terminalId, status: "OPEN", userId: session.userId },
      select: { id: true },
    });

    await prisma.authSession.update({
      where: { id: session.sessionId },
      data: {
        storeId,
        terminalId,
        shiftId: openShift?.id ?? null,
      },
    });

    await createAuditEvent({
      actorUserId: session.userId,
      shiftId: openShift?.id ?? undefined,
      action: "sesion_contexto_actualizar",
      entityType: "auth_session",
      entityId: session.sessionId,
      message: `Contexto sesion: storeId=${storeId} terminalId=${terminalId}`,
      dataJson: {
        storeId,
        terminalId,
        shiftId: openShift?.id ?? null,
      } as Prisma.InputJsonValue,
    });

    return NextResponse.json({
      storeId,
      terminalId,
      shiftId: openShift?.id ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    console.error("Error en PATCH /api/auth/context:", error);
    return NextResponse.json({ error: "Error al actualizar contexto" }, { status: 500 });
  }
}
