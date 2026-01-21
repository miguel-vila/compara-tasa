import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = "https://comparatasa.co";
const siteName = "Compara Tasa";
const title = "Compara Tasa | Compara Tasas Bancarias en Colombia";
const description =
  "Compara las mejores tasas bancarias en Colombia: crédito hipotecario, leasing habitacional y cuentas de ahorro. Información actualizada de Bancolombia, BBVA, Scotiabank, y más.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "tasas bancarias",
    "crédito hipotecario",
    "leasing habitacional",
    "cuentas de ahorro",
    "Colombia",
    "vivienda",
    "UVR",
    "VIS",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName,
    title,
    description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Compara Tasa - Compara tasas bancarias en Colombia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
