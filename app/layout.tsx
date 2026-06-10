import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AETHER CLASH — 3vs3 Browser MOBA",
  description:
    "魔法・機械・自然・霊体が交錯する3vs3ブラウザMOBA。スマホ横向き対応、CPU戦・ローカル対人戦に対応。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AETHER CLASH",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="overflow-hidden bg-[#0b1220] antialiased">{children}</body>
    </html>
  );
}
