import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { AuthError, assertHasPermission, getEffectivePermissionCodes, getSessionContextById } from "@/lib/auth";
import { assertStoreAccess, assertTerminalBelongsToStore } from "@/lib/store-access";
import { createAuditEvent } from "@/lib/audit";
import { parseOpeningCashPayload } from "@/lib/opening-denominations";

/** Listado de turnos (propios o con permiso de arqueo). */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    const permsList = await getEffectivePermissionCodes(session.userId);
    if (
      !permsList.has("turno_abrir") &&
      !permsList.has("turno_cerrar") &&
      !permsList.has("turno_arqueo")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    const status = searchParams.get("status") as "OPEN" | "CLOSED" | null;
    const limit = Math.min(Number(searchParams.get("limit") ?? "30") || 30, 100);

    const canArqueo = permsList.has("turno_arqueo");

    const where: Prisma.ShiftWhereInput = {};
    if (!canArqueo) {
      where.userId = session.userId;
    }

    if (storeId && Number.isFinite(Number(storeId))) {
      const sid = Number(storeId);
      await assertStoreAccess(session.userId, sid);
      where.storeId = sid;
    }

    if (status === "OPEN" || status === "CLOSED") {
      where.status = status;
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        terminal: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error en GET /api/turnos:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al listar turnos" }, { status: 500 });
  }
}

/** Abrir turno (una caja = un turno OPEN a la vez). */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "turno_abrir");

    const body = (await request.json()) as {
      storeId?: number;
      terminalId?: number;
      openingCashAmount?: number | null;
      openingDenominations?: unknown;
    };

    const storeId = Number(body?.storeId);
    const terminalId = Number(body?.terminalId);

    if (!Number.isFinite(storeId) || !Number.isFinite(terminalId)) {
      return NextResponse.json(
        { error: "storeId y terminalId son obligatorios (numeros validos)" },
        { status: 400 },
      );
    }

    const parsed = parseOpeningCashPayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { openingCashAmount, openingDenominationsJson } = parsed;

    await assertStoreAccess(session.userId, storeId);
    await assertTerminalBelongsToStore(terminalId, storeId);

    const existing = await prisma.shift.findFirst({
      where: { terminalId, status: "OPEN" },
      select: { id: true, userId: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Ya hay un turno abierto en esta caja. Cierralo antes de abrir otro.",
          openShiftId: existing.id,
        },
        { status: 409 },
      );
    }

    const shift = await prisma.shift.create({
      data: {
        storeId,
        terminalId,
        userId: session.userId,
        status: "OPEN",
        openingCashAmount,
        openingDenominationsJson:
          openingDenominationsJson === null ? Prisma.DbNull : openingDenominationsJson,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        terminal: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    {
      const now = new Date();
      await prisma.authSession.updateMany({
        where: {
          id: session.sessionId,
          userId: session.userId,
          endedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          storeId,
          terminalId,
          shiftId: shift.id,
        },
      });
    }

    await createAuditEvent({
      actorUserId: session.userId,
      shiftId: shift.id,
      action: "turno_abrir",
      entityType: "shift",
      entityId: shift.id,
      message: `Apertura turno id=${shift.id} caja terminalId=${terminalId}`,
      dataJson: {
        openingCashAmount: String(shift.openingCashAmount),
        openingMode: parsed.mode,
        openingDenominations:
          shift.openingDenominationsJson === null
            ? null
            : shift.openingDenominationsJson,
        storeId: shift.storeId,
        terminalId: shift.terminalId,
      } as Prisma.InputJsonValue,
      fields: [
        {
          fieldPath: "shift.openingCashAmount",
          oldValue: null,
          newValue: String(shift.openingCashAmount),
        },
      ],
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/turnos:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al abrir turno" }, { status: 500 });
  }
}
