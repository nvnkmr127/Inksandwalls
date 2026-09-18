import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/correlation";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const correlationId = getCorrelationId(req.headers);
  const pathname = req.nextUrl.pathname;

  // Protect /admin route namespace
  if (pathname.startsWith("/admin")) {
    const isApiRequest = pathname.startsWith("/admin/api") || req.headers.get("accept")?.includes("application/json");

    // 1. Unauthenticated -> 401 / redirect to login
    if (!req.auth || !req.auth.user) {
      if (isApiRequest) {
        const response = NextResponse.json(
          { error: { code: "UNAUTHENTICATED", message: "Authentication required", correlationId } },
          { status: 401 }
        );
        response.headers.set("x-request-id", correlationId);
        return response;
      }
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
      return NextResponse.redirect(loginUrl);
    }

    // 2. Authenticated but unauthorized role -> 403 Forbidden
    const userRole = req.auth.user.role;
    const isAllowedAdmin = userRole === "STORE_ADMIN" || userRole === "SUPER_ADMIN";

    if (!isAllowedAdmin) {
      const response = NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied", correlationId } },
        { status: 403 }
      );
      response.headers.set("x-request-id", correlationId);
      return response;
    }
  }

  // Extract or generate correlation ID header for request context tracing
  const response = NextResponse.next();
  response.headers.set("x-request-id", correlationId);
  return response;
});

export const config = {
  matcher: [
    /*
     * Exclude static files, internal Next.js assets, and media files from middleware processing:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets with extensions (svg, png, jpg, jpeg, gif, webp, ico, css, js)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
