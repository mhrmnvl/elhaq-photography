import type {MetadataRoute} from "next";

import {getServerEnv} from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getServerEnv().APP_URL.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
