"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, Plus, Pencil, Trash2, Loader2, ExternalLink, FolderOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminDocument } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

export default function AdminDocumentosPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDoc, setEditDoc] = useState<AdminDocument | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mc_admin_documents")
      .select("*")
      .order("section")
      .order("title");
    if (error) toast.error(error.message);
    else setDocuments((data as AdminDocument[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  const sections = useMemo(() => {
    const map = new Map<string, AdminDocument[]>();
    for (const doc of documents) {
      const list = map.get(doc.section) ?? [];
      list.push(doc);
      map.set(doc.section, list);
    }
    return map;
  }, [documents]);

  const saveDoc = async (data: Partial<AdminDocument> & { id?: string }) => {
    try {
      if (data.id) {
        const { error } = await supabase.from("mc_admin_documents").update({
          title: data.title,
          url: data.url,
          section: data.section,
        }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mc_admin_documents").insert({
          title: data.title!,
          url: data.url!,
          section: data.section ?? "General",
          created_by: user?.id,
        });
        if (error) throw error;
      }
      toast.success(t("admin.documentos.saved"));
      setShowDialog(false);
      setEditDoc(null);
      await fetchDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    }
  };

  const deleteDoc = async (id: string) => {
    const { error } = await supabase.from("mc_admin_documents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deleted")); await fetchDocs(); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t("admin.documentos.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("admin.documentos.subtitle")}
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditDoc(null); setShowDialog(true); }}>
          <Plus className="w-4 h-4" /> {t("admin.documentos.add")}
        </Button>
      </div>

      {sections.size === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">{t("admin.documentos.empty")}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4" /> {t("admin.documentos.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        Array.from(sections.entries()).map(([section, docs]) => (
          <section key={section}>
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">{section}</h2>
              <Badge variant="secondary">{docs.length}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <Card
                  key={doc.id}
                  className="group hover:border-primary/40 hover:shadow-md transition-all duration-200"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="w-8 h-8 text-primary/70 shrink-0" />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDoc(doc); setShowDialog(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteDoc(doc.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1.5 hover:text-primary transition-colors",
                          "underline-offset-4 hover:underline",
                        )}
                      >
                        {doc.title}
                        <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                      </a>
                    </CardTitle>
                    <CardDescription className="truncate text-xs">{doc.url}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {showDialog && (
        <DocumentDialog
          doc={editDoc}
          onClose={() => { setShowDialog(false); setEditDoc(null); }}
          onSave={saveDoc}
        />
      )}
    </div>
  );
}

function DocumentDialog({
  doc, onClose, onSave,
}: {
  doc: AdminDocument | null;
  onClose: () => void;
  onSave: (data: Partial<AdminDocument> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(doc?.title ?? "");
  const [url, setUrl] = useState(doc?.url ?? "");
  const [section, setSection] = useState(doc?.section ?? "General");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{doc ? t("admin.documentos.editTitle") : t("admin.documentos.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("admin.common.title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.documentos.titlePlaceholder")} /></div>
          <div><Label>{t("admin.common.url")}</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("admin.documentos.urlPlaceholder")} type="url" /></div>
          <div><Label>{t("admin.common.section")}</Label><Input value={section} onChange={(e) => setSection(e.target.value)} placeholder={t("admin.documentos.sectionPlaceholder")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSave({ id: doc?.id, title, url, section })}>{t("admin.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
