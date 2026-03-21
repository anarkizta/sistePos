import { NextResponse } from "next/server";
import { getLoginLockState } from "@/lib/login-lockout";

/**
 * GET /api/auth/login-status?username=alias
 * Consulta si el alias puede intentar login (sin revelar si el usuario existe).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = String(searchParams.get("username") ?? "").trim();

    if (!username) {
      return NextResponse.json(
        { error: "Parametro username es obligatorio" },
        { status: 400 },
      );
    }

    const state = await getLoginLockState(username);

    let message: string | null = null;
    if (state.accountLocked && state.accountUnlockAt) {
      message = `Cuenta bloqueada temporalmente. Puedes volver a intentar despues de ${state.accountUnlockAt}.`;
    } else if (state.rateLimited && state.rateLimitUnlockAt) {
      message = `Demasiados intentos fallidos. Espera hasta aproximadamente ${state.rateLimitUnlockAt} o contacta al administrador.`;
    } else if (state.locked) {
      message = "Acceso temporalmente restringido por seguridad.";
    }

    return NextResponse.json({
      username,
      locked: state.locked,
      accountLocked: state.accountLocked,
      rateLimited: state.rateLimited,
      failedInWindow: state.failedInWindow,
      maxAttempts: state.maxAttempts,
      windowMinutes: state.windowMinutes,
      attemptsRemaining: state.attemptsRemaining,
      accountUnlockAt: state.accountUnlockAt,
      rateLimitUnlockAt: state.rateLimitUnlockAt,
      message,
    });
  } catch (error) {
    console.error("Error en GET /api/auth/login-status:", error);
    return NextResponse.json({ error: "Error al consultar estado" }, { status: 500 });
  }
}
