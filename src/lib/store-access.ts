import prisma from "@/lib/prisma";
import { AuthError } from "@/lib/auth";

/** Administrador y supervisor pueden operar en cualquier sucursal; cajero solo con `store_user` activo. */
export async function userHasStoreAccess(userId: number, storeId: number): Promise<boolean> {
  const privileged = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { code: { in: ["ADMIN", "SUPERVISOR"] } },
    },
  });
  if (privileged) return true;

  const link = await prisma.storeUser.findFirst({
    where: { userId, storeId, isActive: true },
  });
  return !!link;
}

export async function assertStoreAccess(userId: number, storeId: number) {
  const ok = await userHasStoreAccess(userId, storeId);
  if (!ok) {
    throw new AuthError("No tienes acceso a esta sucursal", 403);
  }
}

export async function assertTerminalBelongsToStore(terminalId: number, storeId: number) {
  const t = await prisma.terminal.findFirst({
    where: { id: terminalId, storeId, isActive: true },
    select: { id: true },
  });
  if (!t) {
    throw new AuthError("Caja o sucursal invalida", 400);
  }
}
