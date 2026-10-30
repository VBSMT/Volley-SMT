import { ServiceWorker } from "@/components/ServiceWorker";
import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { cookies } from "next/headers";
import { PALETTE_COOKIE, PALETTES, THEME_COOKIE, paletteAttribute, themeAttribute } from "@/lib/theme";
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
  // iPhone : nom sous l'icône et barre d'état noire une fois ajoutée à l'écran d'accueil.
  appleWebApp: { capable: true, title: "Volley SMT", statusBarStyle: "black" },
};

/** Barre du téléphone : couleur foncée du thème choisi. */
export async function generateViewport(): Promise<Viewport> {
  const palette = paletteAttribute((await cookies()).get(PALETTE_COOKIE)?.value) ?? "club";
  return { themeColor: PALETTES.find((p) => p.value === palette)!.dark };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      data-theme={themeAttribute((await cookies()).get(THEME_COOKIE)?.value)}
      data-palette={paletteAttribute((await cookies()).get(PALETTE_COOKIE)?.value)}
    >
      <body className={`${barlow.variable} ${barlowCondensed.variable}`}>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
