import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Error en GET /api/clientes:", error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data?.name || !String(data.name).trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    const customer = await prisma.customer.create({
      data: {
        name: String(data.name).trim(),
        rut: data.rut ? String(data.rut).trim() : null,
        email: data.email ? String(data.email).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        credit:
          data.credit !== undefined && data.credit !== null && String(data.credit).trim() !== ""
            ? parseFloat(String(data.credit))
            : 0,
      }
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/clientes:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese RUT" },
          { status: 409 }
        );
      }
    }
    const message = error instanceof Error ? error.message : "Error al crear cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
