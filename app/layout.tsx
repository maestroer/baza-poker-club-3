import type { Metadata, Viewport } from "next";
import { Caveat, Inter_Tight, JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

// Плотный гротеск для заголовков и рукописный шрифт для акцентного слова
const display = Inter_Tight({ variable: "--font-display", subsets: ["latin", "cyrillic"], weight: ["600", "800"] });
const script = Caveat({ variable: "--font-script", subsets: ["latin", "cyrillic"], weight: ["700"] });
// Широкий гротеск — как надпись в логотипе ФЛЭШ; только для названия на заставке
const brand = Unbounded({ variable: "--font-brand", subsets: ["latin", "cyrillic"], weight: ["900"] });
const body = Manrope({ variable: "--font-body", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin", "cyrillic"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline.toLowerCase()}`,
  description: "Покер как спорт: без денежных ставок, с рейтингом сезона, кальяном и баром. Запишитесь на ближайшую игру.",
};

export const viewport: Viewport = { themeColor: "#0b0605" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${display.variable} ${script.variable} ${brand.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
