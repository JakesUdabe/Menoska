"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getBulletin, type StoredBulletin } from "@/lib/bulletins-store";
import { BulletinEditor } from "@/components/bulletin-editor";
import { useT } from "@/i18n/provider";

export default function EditBulletinPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const [bulletin, setBulletin] = useState<StoredBulletin | null | undefined>(undefined);

  useEffect(() => {
    setBulletin(getBulletin(params.id) ?? null);
  }, [params.id]);

  if (bulletin === undefined) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!bulletin) return <p>404</p>;
  return <BulletinEditor initial={bulletin} />;
}
