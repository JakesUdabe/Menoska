import { notFound } from "next/navigation";
import { AppI18nProvider } from "@/i18n/provider";
import { isLocale, LOCALES, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { AuthProvider } from "@/components/auth-provider";
import { CookieBanner } from "@/components/cookie-banner";
import { Toaster } from "@/components/ui/sonner";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = createTranslator(locale);

  return (
    <AppI18nProvider locale={locale}>
      <AuthProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          {t("common.skipToContent")}
        </a>
        {children}
        <CookieBanner />
        <Toaster />
      </AuthProvider>
    </AppI18nProvider>
  );
}
