import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/site/"],
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: "https://elturcosmm.com/sitemap.xml",
    host: "https://elturcosmm.com",
  };
}
