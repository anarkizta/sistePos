import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  AuthError,
  assertHasAnyPermission,
  assertHasPermission,
  getSessionContextById,
} from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";

/** Listado completo para administracion (activos e inactivos, con roles). */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasAnyPermission(session.userId, ["usuario_crear", "usuario_editar"]);

    const users = await prisma.user.findMany({
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        credentialType: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        userRoles: {
          select: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        credentialType: u.credentialType,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        roles: u.userRoles.map((ur) => ur.role),
      })),
    );
  } catch (error) {
    console.error("Error en GET /api/usuarios/gestion:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al listar usuarios" }, { status: 500 });
  }
}

type CreateBody = {
  username?: string;
  displayName?: string;
  credentialType?: "PIN" | "PASSWORD";
  password?: string;
  pin?: string;
  roleIds?: number[];
  isActive?: boolean;
};

/** Crear usuario y asignar roles (requiere usuario_crear y rol_asignar). */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "usuario_crear");
    await assertHasPermission(session.userId, "rol_asignar");

    const body = (await request.json()) as CreateBody;
    const username = String(body?.username ?? "").trim();
    const displayName = String(body?.displayName ?? "").trim();
    const credentialType = body?.credentialType === "PIN" ? "PIN" : "PASSWORD";
    const password = body?.password != null ? String(body.password) : "";
    const pin = body?.pin != null ? String(body.pin) : "";
    const roleIds = Array.isArray(body?.roleIds) ? body.roleIds.map(Number).filter(Number.isFinite) : [];
    const isActive = body?.isActive !== false;

    if (!username || !displayName) {
      return NextResponse.json(
        { error: "username y displayName son obligatorios" },
        { status: 400 },
      );
    }
    if (roleIds.length === 0) {
      return NextResponse.json({ error: "Debes asignar al menos un rol" }, { status: 400 });
    }

    let pinHash: string | null = null;
    let passwordHash: string | null = null;
    if (credentialType === "PASSWORD") {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "La clave debe tener al menos 6 caracteres" },
          { status: 400 },
        );
      }
      passwordHash = await bcrypt.hash(password, 12);
    } else {
      if (pin.length < 4) {
        return NextResponse.json({ error: "El PIN debe tener al menos 4 digitos" }, { status: 400 });
      }
      pinHash = await bcrypt.hash(pin, 12);
    }

    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      return NextResponse.json({ error: "Uno o mas roles no existen" }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          displayName,
          credentialType,
          pinHash,
          passwordHash,
          isActive,
        },
      });

      for (const rid of roleIds) {
        await tx.userRole.create({
          data: { userId: created.id, roleId: rid },
        });
      }

      return created;
    });

    await createAuditEvent({
      actorUserId: session.userId,
      action: "usuario_crear",
      entityType: "user",
      entityId: user.id,
      message: `Usuario creado: ${user.username}`,
      dataJson: {
        username: user.username,
        displayName: user.displayName,
        credentialType: user.credentialType,
        roleIds,
        isActive: user.isActive,
      } as Prisma.InputJsonValue,
    });

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        credentialType: user.credentialType,
        isActive: user.isActive,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error en POST /api/usuarios/gestion:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese alias" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
