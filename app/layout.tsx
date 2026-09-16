import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELTURKO SMM Yönetim",
  description: "ELTURKO SMM hizmet ve fiyat yönetim paneli.",
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
