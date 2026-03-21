import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  AuthError,
  assertHasAnyPermission,
  getSessionContextById,
} from "@/lib/auth";

/** Listado de roles (para asignar al crear/editar usuario). */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasAnyPermission(session.userId, ["usuario_crear", "rol_asignar"]);

    const roles = await prisma.role.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error en GET /api/roles:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al listar roles" }, { status: 500 });
  }
}
