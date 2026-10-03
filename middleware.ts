import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "shahabgram_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/auth" || pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
