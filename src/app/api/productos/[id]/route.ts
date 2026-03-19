import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import {
  AuthError,
  assertHasPermission,
  assertHasPermissionOrAuthorization,
  getSessionContextById,
} from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/productos/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "inventario_consultar");

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error(`Error en GET /api/productos/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
  }
}

// PUT /api/productos/[id]
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    const authId = Number(req.headers.get("x-sp-authorization-id") ?? "");
    await assertHasPermissionOrAuthorization(
      session.userId,
      "producto_editar",
      authId,
      "producto_editar",
    );

    const data = await req.json();
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name: data.name,
        barcode: data.barcode || null,
        description: data.description || null,
        price: parseFloat(data.price),
        stock: parseInt(data.stock),
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error(`Error en PUT /api/productos/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese código de barras" },
          { status: 409 }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

// DELETE /api/productos/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    const authId = Number(_req.headers.get("x-sp-authorization-id") ?? "");
    await assertHasPermissionOrAuthorization(
      session.userId,
      "producto_editar",
      authId,
      "producto_borrar",
    );

    await prisma.product.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error(`Error en DELETE /api/productos/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
