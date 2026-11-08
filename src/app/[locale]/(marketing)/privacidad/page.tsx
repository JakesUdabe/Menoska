import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose-legal">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t("legal.privacyTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Menoska Consulting trata datos de contacto, cuentas de empresa y preferencias de vigilancia tecnológica para prestar el
          servicio. La base jurídica es la ejecución del contrato (art. 6.1.b RGPD) y el interés legítimo en la seguridad
          del servicio.
        </p>
        <p>
          Conservamos los perfiles mientras la cuenta esté activa y los registros de envío el tiempo necesario para evitar
          duplicados y dar soporte. Puede ejercer acceso, rectificación, oposición, limitación, portabilidad y supresión
          desde el panel (solicitud de baja RGPD) o escribiendo a privacy@menoska.com.
        </p>
        <p>
          Los encargados del tratamiento son Supabase (UE), Resend (correo transaccional) y Stripe (pagos). No vendemos
          datos. Las transferencias fuera del EEE solo se hacen con cláusulas contractuales tipo.
        </p>
      </div>
    </article>
  );
}
