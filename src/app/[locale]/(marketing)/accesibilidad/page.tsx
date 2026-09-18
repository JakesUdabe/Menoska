import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t("legal.a11yTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          ABI News sigue WCAG 2.1 nivel AA. Eso incluye contraste de color, navegación por teclado, textos alternativos,
          etiquetas de formulario, idioma de página y un enlace de salto al contenido.
        </p>
        <p>
          El selector de idioma y el banner de cookies son operables con teclado y anuncian su propósito a lectores de
          pantalla. Si encuentra una barrera, escríbanos a accesibilidad@abinews.com.
        </p>
      </div>
    </article>
  );
}
