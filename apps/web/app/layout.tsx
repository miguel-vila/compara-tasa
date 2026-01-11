import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Mejor Tasa | Tasas de Crédito Hipotecario en Colombia",
  description:
    "Compara las mejores tasas de crédito hipotecario y leasing habitacional en Colombia. Información actualizada de Bancolombia, BBVA, Scotiabank, y más.",
  keywords: [
    "crédito hipotecario",
    "leasing habitacional",
    "tasas hipotecarias",
    "Colombia",
    "vivienda",
    "UVR",
    "VIS",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
