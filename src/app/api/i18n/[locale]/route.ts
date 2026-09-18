import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/locales";
import { getMessages } from "@/i18n/messages";

export const runtime = "edge";

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "unsupported_locale" }, { status: 400 });
  }
  return NextResponse.json(getMessages(locale));
}
