import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { AuthError, assertHasPermission, getSessionContextById } from "@/lib/auth";
import { auditValue, createAuditEvent, diffFields } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/clientes/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "cliente_consultar");

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error(`Error en GET /api/clientes/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
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
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "cliente_gestionar");

    const data = await req.json();
    if (!data?.name || !String(data.name).trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const before = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!before) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: String(data.name).trim(),
        rut: data.rut ? String(data.rut).trim() : null,
        email: data.email ? String(data.email).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        credit:
          data.credit !== undefined && data.credit !== null && String(data.credit).trim() !== ""
            ? Number.parseFloat(String(data.credit))
            : 0,
      },
    });

    const beforeRec: Record<string, unknown> = {
      name: before.name,
      rut: before.rut,
      email: before.email,
      phone: before.phone,
      credit: before.credit,
    };
    const afterRec: Record<string, unknown> = {
      name: customer.name,
      rut: customer.rut,
      email: customer.email,
      phone: customer.phone,
      credit: customer.credit,
    };
    const fields = diffFields(
      "customer",
      ["name", "rut", "email", "phone", "credit"],
      beforeRec,
      afterRec,
    );

    await createAuditEvent({
      actorUserId: session.userId,
      action: "cliente_editar",
      entityType: "customer",
      entityId: customer.id,
      message: `Edicion cliente id=${customer.id}`,
      dataJson: {
        before: {
          name: auditValue(before.name),
          rut: auditValue(before.rut),
          email: auditValue(before.email),
          phone: auditValue(before.phone),
          credit: auditValue(before.credit),
        },
        after: {
          name: auditValue(customer.name),
          rut: auditValue(customer.rut),
          email: auditValue(customer.email),
          phone: auditValue(customer.phone),
          credit: auditValue(customer.credit),
        },
      } as Prisma.InputJsonValue,
      fields: fields.length > 0 ? fields : undefined,
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error(`Error en PUT /api/clientes/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese RUT" },
          { status: 409 },
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
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    const session = await getSessionContextById(sessionId);
    await assertHasPermission(session.userId, "cliente_gestionar");

    const before = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!before) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    await createAuditEvent({
      actorUserId: session.userId,
      action: "cliente_eliminar",
      entityType: "customer",
      entityId: customerId,
      message: `Eliminacion cliente id=${customerId} nombre=${before.name}`,
      dataJson: {
        deleted: {
          name: before.name,
          rut: before.rut,
          email: before.email,
          phone: before.phone,
          credit: String(before.credit),
        },
      } as Prisma.InputJsonValue,
      fields: [
        { fieldPath: "customer.name", oldValue: String(before.name), newValue: null },
        { fieldPath: "customer.rut", oldValue: before.rut ? String(before.rut) : null, newValue: null },
        { fieldPath: "customer.credit", oldValue: String(before.credit), newValue: null },
      ],
    });

    return NextResponse.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error(`Error en DELETE /api/clientes/${id}:`, error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiredPermission: error.requiredPermission ?? null },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Error al eliminar cliente" }, { status: 500 });
  }
}
