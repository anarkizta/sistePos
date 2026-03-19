import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { AuthError } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorizationId = Number(id);
    if (!Number.isFinite(authorizationId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const body = (await request.json()) as {
      approverUsername?: string;
      approverCredential?: string;
    };

    const approverUsername = String(body?.approverUsername ?? "").trim();
    const approverCredential = String(body?.approverCredential ?? "");
    if (!approverUsername || !approverCredential) {
      return NextResponse.json(
        { error: "approverUsername y approverCredential son obligatorios" },
        { status: 400 },
      );
    }

    const auth = await prisma.actionAuthorization.findUnique({
      where: { id: authorizationId },
      select: {
        id: true,
        status: true,
        permissionCode: true,
        requestedByUserId: true,
        shiftId: true,
        usedAt: true,
      },
    });

    if (!auth) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    if (auth.status !== "PENDING") {
      return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 409 });
    }
    if (auth.usedAt) {
      return NextResponse.json({ error: "La solicitud ya fue usada" }, { status: 409 });
    }

    const approver = await prisma.user.findUnique({
      where: { username: approverUsername },
      select: {
        id: true,
        isActive: true,
        credentialType: true,
        pinHash: true,
        passwordHash: true,
      },
    });

    if (!approver || !approver.isActive) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const hash = approver.credentialType === "PIN" ? approver.pinHash : approver.passwordHash;
    if (!hash) return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });

    const ok = await bcrypt.compare(approverCredential, hash);
    if (!ok) return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });

    // El aprobador debe tener el permiso requerido
    const approverPerms = await prisma.userRole.findMany({
      where: { userId: approver.id },
      select: {
        role: {
          select: {
            rolePermissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    const permSet = new Set<string>();
    for (const r of approverPerms) {
      for (const rp of r.role.rolePermissions) permSet.add(rp.permission.code);
    }
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId: approver.id },
      select: { effect: true, permission: { select: { code: true } } },
    });
    for (const o of overrides) if (o.effect === "DENY") permSet.delete(o.permission.code);
    for (const o of overrides) if (o.effect === "ALLOW") permSet.add(o.permission.code);

    if (!permSet.has(auth.permissionCode)) {
      const err = new AuthError("No autorizado para aprobar esta accion", 403);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const approved = await tx.actionAuthorization.update({
        where: { id: auth.id },
        data: {
          status: "APPROVED",
          authorizedAt: now,
          authorizedByUserId: approver.id,
        },
        select: { id: true, status: true, authorizedAt: true },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: auth.requestedByUserId,
          impersonatorUserId: approver.id,
          shiftId: auth.shiftId ?? null,
          action: "autorizacion_aprobar",
          entityType: "action_authorization",
          entityId: auth.id,
          dataJson: { permissionCode: auth.permissionCode },
        },
      });

      return approved;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en POST /api/auth/authorizations/[id]/approve:", error);
    return NextResponse.json({ error: "Error al aprobar autorizacion" }, { status: 500 });
  }
}

