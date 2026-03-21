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
import { auditValue, createAuditEvent, diffFields } from "@/lib/audit";

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
    const pid = Number(id);
    const before = await prisma.product.findUnique({ where: { id: pid } });
    if (!before) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id: pid },
      data: {
        name: data.name,
        barcode: data.barcode || null,
        description: data.description || null,
        price: parseFloat(data.price),
        stock: parseInt(data.stock),
      },
    });

    const beforeRec: Record<string, unknown> = {
      name: before.name,
      barcode: before.barcode,
      description: before.description,
      price: before.price,
      stock: before.stock,
    };
    const afterRec: Record<string, unknown> = {
      name: product.name,
      barcode: product.barcode,
      description: product.description,
      price: product.price,
      stock: product.stock,
    };
    const fields = diffFields("product", ["name", "barcode", "description", "price", "stock"], beforeRec, afterRec);

    await createAuditEvent({
      actorUserId: session.userId,
      action: "producto_editar",
      entityType: "product",
      entityId: product.id,
      message: `Edicion producto id=${product.id}`,
      dataJson: {
        before: {
          name: auditValue(before.name),
          barcode: auditValue(before.barcode),
          description: auditValue(before.description),
          price: auditValue(before.price),
          stock: auditValue(before.stock),
        },
        after: {
          name: auditValue(product.name),
          barcode: auditValue(product.barcode),
          description: auditValue(product.description),
          price: auditValue(product.price),
          stock: auditValue(product.stock),
        },
      } as Prisma.InputJsonValue,
      fields: fields.length > 0 ? fields : undefined,
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

    const pid = Number(id);
    const before = await prisma.product.findUnique({ where: { id: pid } });
    if (!before) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await prisma.product.delete({
      where: { id: pid },
    });

    await createAuditEvent({
      actorUserId: session.userId,
      action: "producto_eliminar",
      entityType: "product",
      entityId: pid,
      message: `Eliminacion producto id=${pid} nombre=${before.name}`,
      dataJson: {
        deleted: {
          name: before.name,
          barcode: before.barcode,
          description: before.description,
          price: String(before.price),
          stock: before.stock,
        },
      },
      fields: [
        { fieldPath: "product.name", oldValue: String(before.name), newValue: null },
        { fieldPath: "product.barcode", oldValue: before.barcode ? String(before.barcode) : null, newValue: null },
        { fieldPath: "product.price", oldValue: String(before.price), newValue: null },
        { fieldPath: "product.stock", oldValue: String(before.stock), newValue: null },
      ],
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
