import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://lockedin.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/privacy", "/terms", "/u/"],
      disallow: ["/lockin", "/dashboard", "/rooms", "/explore", "/profile", "/dev", "/auth/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
