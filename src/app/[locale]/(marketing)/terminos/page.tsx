import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose-legal">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t("legal.termsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Estos términos regulan el uso de la plataforma Menoska Consulting (vigilancia tecnológica, inteligencia de
          mercado, scouting y herramientas de decisión financiera). Al crear una cuenta o usar el servicio acepta estas
          condiciones.
        </p>
        <p>
          La licencia de uso es no exclusiva e intransferible, limitada al plan contratado (Starter, Business o
          Enterprise). Queda prohibido revender el acceso, eludir límites de plan o usar la plataforma para actividades
          ilícitas. Los contenidos generados (boletines, informes) son responsabilidad del cliente; Menoska no garantiza
          exhaustividad de fuentes externas (patentes, noticias, redes).
        </p>
        <p>
          La facturación se gestiona vía Stripe según el plan y el ciclo elegidos. Puede cancelar o cambiar de plan desde
          el portal de cliente. El modo demostración no implica relación contractual ni cobro. Para bajas RGPD use el
          panel o escriba a privacy@menoska.com. Derecho aplicable: España / UE.
        </p>
      </div>
    </article>
  );
}
