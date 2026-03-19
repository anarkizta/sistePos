import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthError, getEffectivePermissionCodes, getSessionContextById } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("sp_session_id")?.value ?? "";
    const sessionId = Number(raw);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ session: null, user: null }, { status: 200 });
    }

    const session = await getSessionContextById(sessionId);
    const permissions = await getEffectivePermissionCodes(session.userId);

    return NextResponse.json({
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
      },
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
      },
      permissions: Array.from(permissions).sort(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ session: null, user: null }, { status: 200 });
    }
    console.error("Error en GET /api/auth/me:", error);
    return NextResponse.json({ error: "Error al obtener sesion" }, { status: 500 });
  }
}

