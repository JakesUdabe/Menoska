"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { emptyBulletin, type StoredBulletin } from "@/lib/bulletins-store";
import { BulletinEditor } from "@/components/bulletin-editor";
import { useT } from "@/i18n/provider";

export default function NewBulletinPage() {
  const t = useT();
  const { user } = useAuth();
  const [initial, setInitial] = useState<StoredBulletin | null>(null);

  useEffect(() => {
    if (!user) return;
    setInitial(emptyBulletin(user.id, user.organizationId ?? "org-unknown", user.locale));
  }, [user]);

  if (!user || !initial) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  return <BulletinEditor initial={initial} />;
}
