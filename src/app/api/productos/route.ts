import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { AuthError, assertHasPermission, getSessionContextById } from "@/lib/auth";
import { auditValue, createAuditEvent } from "@/lib/audit";

// GET /api/productos → Listar todos los productos
export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "inventario_consultar");

    const products = await prisma.product.findMany({
      orderBy: { id: "desc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Error en GET /api/productos:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 });
  }
}

// POST /api/productos → Crear un nuevo producto
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "producto_crear");

    const data = await request.json();

    if (!data.name || data.price === undefined) {
      return NextResponse.json(
        { error: "Los campos nombre y precio son obligatorios" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: String(data.name).trim(),
        barcode: data.barcode ? String(data.barcode).trim() : null,
        description: data.description ? String(data.description).trim() : null,
        price: parseFloat(data.price),
        stock: parseInt(data.stock ?? "0"),
      },
    });

    await createAuditEvent({
      actorUserId: session.userId,
      action: "producto_crear",
      entityType: "product",
      entityId: product.id,
      message: `Alta de producto id=${product.id}`,
      dataJson: {
        name: product.name,
        barcode: product.barcode,
        price: auditValue(product.price),
        stock: product.stock,
      },
      fields: [
        { fieldPath: "product.name", oldValue: null, newValue: auditValue(product.name) },
        { fieldPath: "product.barcode", oldValue: null, newValue: auditValue(product.barcode) },
        { fieldPath: "product.description", oldValue: null, newValue: auditValue(product.description) },
        { fieldPath: "product.price", oldValue: null, newValue: auditValue(product.price) },
        { fieldPath: "product.stock", oldValue: null, newValue: auditValue(product.stock) },
      ],
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/productos:", error);
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
    }
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
