import { Prisma } from "@prisma/client";

/** Configuracion de cada denominacion CLP (orden de conteo habitual). */
export const OPENING_DENOMINATION_CONFIG = [
  { value: 20000, label: "Billete $20.000", kind: "billete" as const },
  { value: 10000, label: "Billete $10.000", kind: "billete" as const },
  { value: 5000, label: "Billete $5.000", kind: "billete" as const },
  { value: 2000, label: "Billete $2.000", kind: "billete" as const },
  { value: 1000, label: "Billete $1.000", kind: "billete" as const },
  { value: 500, label: "Moneda $500", kind: "moneda" as const },
  { value: 100, label: "Moneda $100", kind: "moneda" as const },
  { value: 50, label: "Moneda $50", kind: "moneda" as const },
  { value: 10, label: "Moneda $10", kind: "moneda" as const },
] as const;

export type OpeningDenominationKind = (typeof OPENING_DENOMINATION_CONFIG)[number]["kind"];

const DENOM_KEY_SET = new Set(
  OPENING_DENOMINATION_CONFIG.map((c) => String(c.value)),
);

/** Valores unitarios en pesos (derivado de la config). */
export const OPENING_DENOMINATION_VALUES = OPENING_DENOMINATION_CONFIG.map((c) => c.value);

export type OpeningDenominationsNormalized = Record<string, number>;

export function createEmptyOpeningQuantities(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const { value } of OPENING_DENOMINATION_CONFIG) {
    o[String(value)] = 0;
  }
  return o;
}

/** Total en pesos: suma de (valor x cantidad). */
export function sumOpeningDenominations(quantities: Record<string, number>): number {
  let total = 0;
  for (const { value } of OPENING_DENOMINATION_CONFIG) {
    const n = quantities[String(value)];
    const q = typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    total += value * q;
  }
  return total;
}

/**
 * Si el body trae `openingDenominations` (objeto), valida y calcula el total.
 * Si no, devuelve modo legacy con solo `openingCashAmount`.
 */
export function parseOpeningCashPayload(body: {
  openingCashAmount?: number | null;
  openingDenominations?: unknown;
}):
  | { ok: true; mode: "denominations"; openingCashAmount: number; openingDenominationsJson: Prisma.InputJsonValue }
  | { ok: true; mode: "legacy"; openingCashAmount: number; openingDenominationsJson: null }
  | { ok: false; error: string } {
  const raw = body.openingDenominations;
  const hasDenoms =
    raw !== undefined &&
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw);

  if (hasDenoms) {
    const obj = raw as Record<string, unknown>;

    for (const k of Object.keys(obj)) {
      if (!DENOM_KEY_SET.has(k)) {
        return { ok: false, error: `Denominacion no permitida: "${k}"` };
      }
    }

    const quantities: OpeningDenominationsNormalized = {};
    let total = 0;

    for (const { value } of OPENING_DENOMINATION_CONFIG) {
      const key = String(value);
      const cell = obj[key];
      const n = cell === undefined || cell === null ? 0 : Number(cell);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return {
          ok: false,
          error: `Cantidad invalida para $${value.toLocaleString("es-CL")} (entero >= 0)`,
        };
      }
      quantities[key] = n;
      total += value * n;
    }

    if (total <= 0) {
      return {
        ok: false,
        error: "El fondo de apertura por denominaciones debe sumar mas de $0",
      };
    }

    return {
      ok: true,
      mode: "denominations",
      openingCashAmount: total,
      openingDenominationsJson: quantities as Prisma.InputJsonValue,
    };
  }

  const openingCashAmount =
    body.openingCashAmount !== undefined && body.openingCashAmount !== null
      ? Number(body.openingCashAmount)
      : NaN;

  if (!Number.isFinite(openingCashAmount)) {
    return {
      ok: false,
      error:
        "Indica openingCashAmount o openingDenominations (objeto con cantidades por denominacion)",
    };
  }
  if (openingCashAmount < 0) {
    return { ok: false, error: "openingCashAmount no puede ser negativo" };
  }

  return {
    ok: true,
    mode: "legacy",
    openingCashAmount,
    openingDenominationsJson: null,
  };
}
