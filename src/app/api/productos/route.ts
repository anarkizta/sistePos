import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/productos → Listar todos los productos
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "desc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Error en GET /api/productos:", error);
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 });
  }
}

// POST /api/productos → Crear un nuevo producto
export async function POST(request: Request) {
  try {
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

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/productos:", error);
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
