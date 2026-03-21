import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AuthError, getEffectivePermissionCodes, getSessionContextById } from "@/lib/auth";
import { assertStoreAccess } from "@/lib/store-access";
import { computeShiftArqueoTotals } from "@/lib/shift-arqueo";

type Params = { params: Promise<{ id: string }> };

/** Resumen para arqueo: fondo apertura, ventas efectivo/tarjeta, efectivo esperado en caja. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const shiftId = Number(id);
    if (!Number.isFinite(shiftId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    const perms = await getEffectivePermissionCodes(session.userId);

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, status: true, storeId: true, userId: true },
    });
    if (!shift) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    await assertStoreAccess(session.userId, shift.storeId);

    const isOwner = shift.userId === session.userId;
    const canCerrarOwn = perms.has("turno_cerrar") && isOwner;
    const canArqueo = perms.has("turno_arqueo");
    if (!canCerrarOwn && !canArqueo) {
      return NextResponse.json(
        { error: "No autorizado para ver el arqueo de este turno" },
        { status: 403 },
      );
    }

    const totals = await computeShiftArqueoTotals(shiftId);

    return NextResponse.json({
      shiftId,
      status: shift.status,
      openingCash: totals.openingCash,
      salesCash: totals.salesCash,
      salesCard: totals.salesCard,
      salesTotal: totals.salesTotal,
      expectedCashInDrawer: totals.expectedCashInDrawer,
    });
  } catch (error) {
    console.error("Error en GET /api/turnos/[id]/arqueo:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al calcular arqueo" }, { status: 500 });
  }
}
