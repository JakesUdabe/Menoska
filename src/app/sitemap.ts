import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://menoska.consulting").replace(/\/$/, "");

const MARKETING_PATHS = [
  "",
  "/servicios",
  "/precios",
  "/contacto",
  "/login",
  "/registro",
  "/privacidad",
  "/terminos",
  "/aviso-legal",
  "/cookies",
  "/accesibilidad",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return LOCALES.flatMap((locale) =>
    MARKETING_PATHS.map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/servicios" || path === "/precios" ? 0.8 : 0.5,
    })),
  );
}
