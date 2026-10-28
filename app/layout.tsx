import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "600"] });
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: { default: "Volley SMT", template: "%s · Volley SMT" },
  description: "Application du club Volley-Ball Loisirs Saint-Mathieu-de-Tréviers",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${barlow.variable} ${barlowCondensed.variable}`}>{children}</body>
    </html>
  );
}
