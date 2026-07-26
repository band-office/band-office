import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/portal")) {
    const publicPortalRoute = path === "/portal/login"
      || path === "/portal/forgot-password"
      || path === "/portal/reset-password";
    if (!publicPortalRoute && !request.cookies.has("bandos_portal_session")) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    return NextResponse.next();
  }
  if (!request.cookies.has("bandos_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|brand|login|_next/static|_next/image|favicon.ico).*)"],
};
