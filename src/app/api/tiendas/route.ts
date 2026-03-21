import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { AuthError, assertHasPermission, getSessionContextById } from "@/lib/auth";
import { userHasStoreAccess } from "@/lib/store-access";

/** Listado de sucursales y cajas a las que el usuario puede acceder. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = Number(cookieStore.get("sp_session_id")?.value ?? "");
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "turno_abrir");

    const stores = await prisma.store.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: {
        terminals: {
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true, storeId: true },
        },
      },
    });

    const filtered = [];
    for (const s of stores) {
      if (await userHasStoreAccess(session.userId, s.id)) {
        filtered.push({
          id: s.id,
          code: s.code,
          name: s.name,
          terminals: s.terminals,
        });
      }
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error en GET /api/tiendas:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al listar sucursales" }, { status: 500 });
  }
}
