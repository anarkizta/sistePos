import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware (Edge): solo valida presencia de cookie para proteger navegación.
// La validación real (expiración / endedAt) se hace en servidor (API /auth/me y helpers).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Publico
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/favicon")) return NextResponse.next();
  if (pathname.startsWith("/public")) return NextResponse.next();

  const sessionId = request.cookies.get("sp_session_id")?.value;
  if (!sessionId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

