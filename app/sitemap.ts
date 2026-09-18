import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://elturcosmm.com/site/",
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://elturcosmm.com/site/instagram-takipci.html",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://elturcosmm.com/site/tiktok-takipci.html",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://elturcosmm.com/site/youtube-abone.html",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://elturcosmm.com/site/telegram-uye.html",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
