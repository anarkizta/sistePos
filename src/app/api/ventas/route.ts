import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";
import { AuthError, assertHasPermission, getSessionContextById } from "@/lib/auth";

/** Registra una venta en el turno abierto de la sesion (efectivo o tarjeta). */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "venta_cobrar");

    const body = (await request.json()) as {
      totalAmount?: number;
      paymentMethod?: string;
    };

    const totalAmount =
      body?.totalAmount !== undefined && body?.totalAmount !== null
        ? Number(body.totalAmount)
        : NaN;
    const rawMethod = String(body?.paymentMethod ?? "").toUpperCase();
    const paymentMethod =
      rawMethod === "EFECTIVO" || rawMethod === "TARJETA" ? rawMethod : null;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "totalAmount debe ser un numero mayor a 0" },
        { status: 400 },
      );
    }
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "paymentMethod debe ser EFECTIVO o TARJETA" },
        { status: 400 },
      );
    }

    const shiftSessionId = session.shiftId;
    if (!shiftSessionId || !Number.isFinite(shiftSessionId)) {
      return NextResponse.json(
        { error: "No hay turno de caja abierto en tu sesion. Abre turno en Turnos / Caja." },
        { status: 409 },
      );
    }

    const shift = await prisma.shift.findFirst({
      where: { id: shiftSessionId, status: "OPEN" },
      select: { id: true },
    });
    if (!shift) {
      return NextResponse.json(
        { error: "El turno ya no esta abierto. Vuelve a abrir turno o actualiza la sesion." },
        { status: 409 },
      );
    }

    const sale = await prisma.sale.create({
      data: {
        shiftId: shift.id,
        userId: session.userId,
        totalAmount,
        paymentMethod: paymentMethod as PaymentMethod,
      },
    });

    return NextResponse.json(
      {
        id: sale.id,
        shiftId: sale.shiftId,
        totalAmount: String(sale.totalAmount),
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error en POST /api/ventas:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al registrar venta" }, { status: 500 });
  }
}
