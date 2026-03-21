import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  AuthError,
  assertHasPermission,
  getSessionContextById,
} from "@/lib/auth";
import { createAuditEvent, diffFields } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

type UpdateBody = {
  displayName?: string;
  isActive?: boolean;
  credentialType?: "PIN" | "PASSWORD";
  password?: string;
  pin?: string;
  roleIds?: number[];
};

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "usuario_editar");

    const before = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { select: { roleId: true } },
      },
    });
    if (!before) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateBody;
    const hasRoleChange = Array.isArray(body.roleIds);
    if (hasRoleChange) {
      await assertHasPermission(session.userId, "rol_asignar");
    }

    const roleIds = hasRoleChange
      ? (body.roleIds as number[]).map(Number).filter(Number.isFinite)
      : null;
    if (hasRoleChange && roleIds!.length === 0) {
      return NextResponse.json({ error: "Debe quedar al menos un rol" }, { status: 400 });
    }

    if (hasRoleChange && roleIds) {
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true },
      });
      if (roles.length !== roleIds.length) {
        return NextResponse.json({ error: "Uno o mas roles no existen" }, { status: 400 });
      }
    }

    const displayName =
      body.displayName !== undefined ? String(body.displayName).trim() : before.displayName;
    if (!displayName) {
      return NextResponse.json({ error: "displayName no puede quedar vacio" }, { status: 400 });
    }

    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : before.isActive;

    const passwordIn = body.password != null ? String(body.password) : "";
    const pinIn = body.pin != null ? String(body.pin) : "";
    if (passwordIn !== "" && pinIn !== "") {
      return NextResponse.json(
        { error: "Envie solo clave o solo PIN, no ambos" },
        { status: 400 },
      );
    }

    let credentialType = before.credentialType;
    let pinHash = before.pinHash;
    let passwordHash = before.passwordHash;

    if (passwordIn !== "") {
      if (passwordIn.length < 6) {
        return NextResponse.json({ error: "La clave debe tener al menos 6 caracteres" }, { status: 400 });
      }
      credentialType = "PASSWORD";
      passwordHash = await bcrypt.hash(passwordIn, 12);
      pinHash = null;
    } else if (pinIn !== "") {
      if (pinIn.length < 4) {
        return NextResponse.json({ error: "El PIN debe tener al menos 4 digitos" }, { status: 400 });
      }
      credentialType = "PIN";
      pinHash = await bcrypt.hash(pinIn, 12);
      passwordHash = null;
    } else if (body.credentialType === "PIN" || body.credentialType === "PASSWORD") {
      credentialType = body.credentialType;
      if (credentialType === "PIN" && !pinHash) {
        return NextResponse.json(
          { error: "No hay PIN guardado; envie un PIN nuevo" },
          { status: 400 },
        );
      }
      if (credentialType === "PASSWORD" && !passwordHash) {
        return NextResponse.json(
          { error: "No hay clave guardada; envie una clave nueva" },
          { status: 400 },
        );
      }
      if (credentialType === "PIN") {
        passwordHash = null;
      } else {
        pinHash = null;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          displayName,
          isActive,
          credentialType,
          pinHash,
          passwordHash,
        },
      });

      if (hasRoleChange && roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
        for (const rid of roleIds) {
          await tx.userRole.create({ data: { userId, roleId: rid } });
        }
      }
    });

    const after = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { select: { roleId: true } },
      },
    });

    const beforeRec: Record<string, unknown> = {
      displayName: before.displayName,
      isActive: before.isActive,
      credentialType: before.credentialType,
      roleIds: before.userRoles
        .map((r) => r.roleId)
        .sort((a, b) => a - b)
        .join(","),
    };
    const afterRec: Record<string, unknown> = {
      displayName: after!.displayName,
      isActive: after!.isActive,
      credentialType: after!.credentialType,
      roleIds: after!.userRoles
        .map((r) => r.roleId)
        .sort((a, b) => a - b)
        .join(","),
    };

    const fields = diffFields(
      "user",
      ["displayName", "isActive", "credentialType", "roleIds"],
      beforeRec,
      afterRec,
    );

    await createAuditEvent({
      actorUserId: session.userId,
      action: "usuario_editar",
      entityType: "user",
      entityId: userId,
      message: `Usuario actualizado id=${userId}`,
      dataJson: { before: beforeRec, after: afterRec } as Prisma.InputJsonValue,
      fields: fields.length > 0 ? fields : undefined,
    });

    return NextResponse.json({
      id: userId,
      username: after!.username,
      displayName: after!.displayName,
      isActive: after!.isActive,
      credentialType: after!.credentialType,
    });
  } catch (error) {
    console.error("Error en PUT /api/usuarios/gestion/[id]:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}
