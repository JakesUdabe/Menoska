"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isOrgAdmin } from "@/lib/rbac";
import { listProjectsForUser, newProjectId, saveProject, type StoredProject } from "@/lib/projects-repository";
import { toast } from "sonner";

export default function ProjectsPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState<StoredProject[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const seeOrg = isOrgAdmin(user?.role);

  async function refresh() {
    if (!user) return;
    setItems(await listProjectsForUser(user.id, user.organizationId, seeOrg));
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listProjectsForUser(user.id, user.organizationId, seeOrg).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user, seeOrg]);

  async function onCreate() {
    if (!user || !name.trim()) return;
    setCreating(true);
    const now = new Date().toISOString();
    const project: StoredProject = {
      id: newProjectId(),
      organizationId: user.organizationId ?? "org-demo",
      createdBy: user.id,
      name: name.trim(),
      description: description.trim(),
      status: "active",
      links: [],
      meta: {},
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(project, { recordCreate: true });
    setName("");
    setDescription("");
    setCreating(false);
    toast.success(t("projects.created"));
    await refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("projects.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("projects.lead")}</p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border p-4">
        <h2 className="font-semibold">{t("projects.new")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="projectName">{t("projects.name")}</Label>
            <Input id="projectName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="projectDesc">{t("projects.description")}</Label>
            <Input id="projectDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" disabled={creating || !name.trim()} onClick={() => void onCreate()}>
          <Plus className="size-4" /> {t("projects.create")}
        </Button>
      </section>

      <ul className="mt-8 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("projects.empty")}</p>
          </li>
        ) : null}
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={withLocale(locale, `/dashboard/proyectos/${p.id}`)}
              className="block rounded-xl border bg-card p-4 hover:border-signal"
            >
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                {p.status} · {p.links.length} {t("projects.links")}
                {p.description ? ` · ${p.description}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
