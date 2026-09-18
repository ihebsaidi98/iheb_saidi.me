// app/sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://yourdomain.dev", // ← change me
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}