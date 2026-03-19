import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error en GET /api/usuarios:", error);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

