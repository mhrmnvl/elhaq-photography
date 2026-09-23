import createMiddleware from "next-intl/middleware";
import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

import {routing} from "@/i18n/routing";

const intlProxy = createMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return intlProxy(request);
}

export const config = {matcher: ["/((?!api|admin|_next|.*\\..*).*)"]};
