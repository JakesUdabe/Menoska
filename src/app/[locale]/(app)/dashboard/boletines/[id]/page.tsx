"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getBulletin, type StoredBulletin } from "@/lib/bulletins-store";
import { BulletinEditor } from "@/components/bulletin-editor";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";

export default function EditBulletinPage() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [bulletin, setBulletin] = useState<StoredBulletin | null | undefined>(undefined);

  useEffect(() => {
    if (params.id === "nuevo") {
      router.replace(withLocale(locale, "/dashboard/boletines/nuevo"));
      return;
    }
    setBulletin(getBulletin(params.id) ?? null);
  }, [params.id, locale, router]);

  if (bulletin === undefined) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!bulletin) return <p>404</p>;
  return <BulletinEditor initial={bulletin} />;
}
