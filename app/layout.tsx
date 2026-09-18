import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://elturcosmm.com"),
  title: {
    default: "ElTurco SMM — Sosyal Medya Hizmetleri",
    template: "%s | ElTurco SMM",
  },
  description:
    "Instagram, TikTok, YouTube, Telegram ve diğer platformlar için hızlı, güvenli ve otomatik sosyal medya hizmetleri.",
  alternates: {
    canonical: "/site/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/site/",
    siteName: "ElTurco SMM",
    title: "ElTurco SMM — Sosyal Medya Hizmetleri",
    description:
      "Hızlı, güvenli ve otomatik sosyal medya hizmetleri.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
