import prisma from "@/lib/prisma";

export type ArqueoTotals = {
  openingCash: number;
  salesCash: number;
  salesCard: number;
  salesTotal: number;
  expectedCashInDrawer: number;
};

function num(d: unknown): number {
  if (d == null) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

/** Totales de arqueo para un turno (ventas registradas en `sale`). */
export async function computeShiftArqueoTotals(shiftId: number): Promise<ArqueoTotals> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { openingCashAmount: true },
  });
  if (!shift) {
    throw new Error("Turno no encontrado");
  }

  const openingCash = num(shift.openingCashAmount);

  const grouped = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: { shiftId },
    _sum: { totalAmount: true },
  });

  let salesCash = 0;
  let salesCard = 0;
  for (const row of grouped) {
    const sum = num(row._sum.totalAmount);
    if (row.paymentMethod === "EFECTIVO") {
      salesCash += sum;
    } else if (row.paymentMethod === "TARJETA") {
      salesCard += sum;
    }
  }

  const salesTotal = salesCash + salesCard;
  const expectedCashInDrawer = openingCash + salesCash;

  return {
    openingCash,
    salesCash,
    salesCard,
    salesTotal,
    expectedCashInDrawer,
  };
}
