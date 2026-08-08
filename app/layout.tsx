import type { Metadata } from "next";
import { Big_Shoulders, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// adjustFontFallback queda apagado porque Next no tiene métricas de esta fuente
// y avisa en cada compilación; el fallback lo damos a mano.
const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Impact", "Haettenschweiler", "sans-serif"],
});

const body = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://novals.es"),
  title: {
    default: "NOVA · Los Santos",
    template: "%s · NOVA Los Santos",
  },
  description:
    "Servidor de roleplay NOVA Los Santos: noticias, whitelist, facciones y staff.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
