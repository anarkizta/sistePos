import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import {
  AuthError,
  assertHasPermission,
  getEffectivePermissionCodes,
  getSessionContextById,
} from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Cerrar turno: el cajero cierra el propio; supervisor/admin con turno_arqueo puede cerrar el de otro. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const shiftId = Number(id);
    if (!Number.isFinite(shiftId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);

    const body = (await request.json()) as { closingCashAmount?: number };
    const closingCashAmount =
      body?.closingCashAmount !== undefined && body?.closingCashAmount !== null
        ? Number(body.closingCashAmount)
        : NaN;
    if (!Number.isFinite(closingCashAmount) || closingCashAmount < 0) {
      return NextResponse.json(
        { error: "closingCashAmount es obligatorio y debe ser un numero >= 0" },
        { status: 400 },
      );
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        terminal: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (shift.status !== "OPEN") {
      return NextResponse.json({ error: "El turno ya esta cerrado" }, { status: 409 });
    }

    const perms = await getEffectivePermissionCodes(session.userId);
    const canArqueo = perms.has("turno_arqueo");
    const isOwner = shift.userId === session.userId;

    if (isOwner) {
      await assertHasPermission(session.userId, "turno_cerrar");
    } else if (canArqueo) {
      await assertHasPermission(session.userId, "turno_arqueo");
    } else {
      return NextResponse.json(
        { error: "Solo puedes cerrar tu propio turno o necesitas permiso de arqueo" },
        { status: 403 },
      );
    }

    const now = new Date();
    const opening = Number(shift.openingCashAmount);
    const difference = closingCashAmount - opening;

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: "CLOSED",
        closedAt: now,
        closingCashAmount,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        terminal: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    await prisma.authSession.updateMany({
      where: { shiftId },
      data: { shiftId: null },
    });

    await createAuditEvent({
      actorUserId: session.userId,
      shiftId: updated.id,
      action: "turno_cerrar",
      entityType: "shift",
      entityId: updated.id,
      message: `Cierre turno id=${updated.id} diferencia_efectivo=${difference.toFixed(2)}`,
      dataJson: {
        shiftOwnerUserId: shift.userId,
        closedByUserId: session.userId,
        supervisorClose: !isOwner,
        openingCashAmount: String(shift.openingCashAmount),
        closingCashAmount: String(closingCashAmount),
        difference: String(difference),
      } as Prisma.InputJsonValue,
      fields: [
        {
          fieldPath: "shift.status",
          oldValue: "OPEN",
          newValue: "CLOSED",
        },
        {
          fieldPath: "shift.closingCashAmount",
          oldValue: null,
          newValue: String(closingCashAmount),
        },
      ],
    });

    return NextResponse.json({
      shift: updated,
      report: {
        openingCashAmount: opening,
        closingCashAmount,
        difference,
        closedAt: updated.closedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error en PATCH /api/turnos/[id]/cerrar:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al cerrar turno" }, { status: 500 });
  }
}
