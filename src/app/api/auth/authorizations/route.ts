import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AuthError, getSessionContextById } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);

    const body = (await request.json()) as {
      permissionCode?: string;
      context?: unknown;
      shiftId?: number | null;
    };

    const permissionCode = String(body?.permissionCode ?? "").trim();
    if (!permissionCode) {
      return NextResponse.json({ error: "permissionCode es obligatorio" }, { status: 400 });
    }

    const created = await prisma.actionAuthorization.create({
      data: {
        requestedByUserId: session.userId,
        shiftId: body?.shiftId ?? null,
        permissionCode,
        contextJson: body?.context === undefined ? Prisma.JsonNull : (body.context as Prisma.InputJsonValue),
        status: "PENDING",
      },
      select: { id: true, status: true, requestedAt: true },
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: session.userId,
        shiftId: body?.shiftId ?? null,
        action: "autorizacion_solicitar",
        entityType: "action_authorization",
        entityId: created.id,
        dataJson:
          body?.context === undefined
            ? ({ permissionCode } as Prisma.InputJsonValue)
            : ({ permissionCode, context: body.context } as Prisma.InputJsonValue),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error en POST /api/auth/authorizations:", error);
    return NextResponse.json({ error: "Error al solicitar autorizacion" }, { status: 500 });
  }
}

