import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditFieldChange = {
  fieldPath: string;
  oldValue: string | null;
  newValue: string | null;
};

/** Serializa valores Prisma (Decimal, Date, etc.) para texto en auditoria. */
export function auditValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "toFixed" in v) {
    return String(v);
  }
  return String(v);
}

type CreateAuditInput = {
  actorUserId: number;
  shiftId?: number | null;
  impersonatorUserId?: number | null;
  result?: "SUCCESS" | "FAIL";
  action: string;
  entityType: string;
  entityId: number | null;
  message?: string | null;
  dataJson?: Prisma.InputJsonValue | null;
  fields?: AuditFieldChange[];
};

/**
 * Registra un evento de auditoria y opcionalmente filas en audit_event_field.
 * No lanza: los errores se registran en consola para no romper el flujo principal.
 */
export async function createAuditEvent(input: CreateAuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        shiftId: input.shiftId ?? null,
        impersonatorUserId: input.impersonatorUserId ?? null,
        result: input.result ?? "SUCCESS",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        message: input.message ?? null,
        dataJson:
          input.dataJson === undefined || input.dataJson === null
            ? Prisma.JsonNull
            : input.dataJson,
        fields:
          input.fields && input.fields.length > 0
            ? {
                create: input.fields.map((f) => ({
                  fieldPath: f.fieldPath,
                  oldValue: f.oldValue,
                  newValue: f.newValue,
                })),
              }
            : undefined,
      },
    });
  } catch (e) {
    console.error("[audit] createAuditEvent failed:", e);
  }
}

/** Comparacion campo a campo para entidades planas (strings/numbers). */
export function diffFields(
  prefix: string,
  keys: string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditFieldChange[] {
  const out: AuditFieldChange[] = [];
  for (const key of keys) {
    const oldV = auditValue(before[key]);
    const newV = auditValue(after[key]);
    if (oldV !== newV) {
      out.push({
        fieldPath: `${prefix}.${key}`,
        oldValue: oldV,
        newValue: newV,
      });
    }
  }
  return out;
}
