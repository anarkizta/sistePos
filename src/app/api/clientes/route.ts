import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: "Error fetch customers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        rut: data.rut || null,
        email: data.email || null,
        phone: data.phone || null,
        credit: data.credit ? parseFloat(data.credit) : 0,
      }
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error creating customer" }, { status: 500 });
  }
}
