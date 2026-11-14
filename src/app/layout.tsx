import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { LocaleProvider } from "@/components/locale";
import { Shell } from "@/components/shell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://menoska-consulting.com"),
  title: "Menoska Consulting · Dirección financiera",
  description:
    "Dirección financiera externa para empresas tecnológicas e industriales. Modelos, tesorería, capital, fiscalidad, ingresos y financiación no dilutiva desde Zarautz.",
  openGraph: {
    title: "Menoska Consulting · Dirección financiera",
    description:
      "Dirección financiera externa para empresas tecnológicas e industriales. Modelos, tesorería, capital, fiscalidad, ingresos y financiación no dilutiva desde Zarautz.",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/og-default.png", alt: "Menoska Consulting" }],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={outfit.variable}>
      <body>
        <LocaleProvider>
          <Shell>{children}</Shell>
        </LocaleProvider>
      </body>
    </html>
  );
}
