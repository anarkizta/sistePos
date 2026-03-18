import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/clientes/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error(`Error en GET /api/clientes/${id}:`, error);
    return NextResponse.json({ error: "Error al obtener cliente" }, { status: 500 });
  }
}

// PUT /api/clientes/[id]
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const data = await req.json();
    if (!data?.name || !String(data.name).trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: String(data.name).trim(),
        rut: data.rut ? String(data.rut).trim() : null,
        email: data.email ? String(data.email).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        credit: data.credit !== undefined && data.credit !== null && String(data.credit).trim() !== ""
          ? Number.parseFloat(String(data.credit))
          : 0,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error(`Error en PUT /api/clientes/${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese RUT" },
          { status: 409 }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Error al actualizar cliente" }, { status: 500 });
  }
}

// DELETE /api/clientes/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.customer.delete({
      where: { id: customerId },
    });
    return NextResponse.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error(`Error en DELETE /api/clientes/${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Error al eliminar cliente" }, { status: 500 });
  }
}

