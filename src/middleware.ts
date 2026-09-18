import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/correlation";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Extract or generate correlation ID header for request context tracing
  const correlationId = getCorrelationId(req.headers);
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
