"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Pencil, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { copyText } from "@/lib/admin/crm-commercial";
import { cn } from "@/lib/utils";
import type { CrmPlaybookEntry } from "@/lib/admin/types";

const ORDER = ["demo_script", "objeciones", "one_pager", "roi"];

type PlaybookBlock =
  | { type: "text"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function isMdTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isMdSeparator(line: string) {
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function splitCells(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEnd = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutEnd.split("|").map((cell) => cell.trim());
}

function parsePlaybookBlocks(body: string): PlaybookBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: PlaybookBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isMdTableRow(lines[i])) {
      const tableLines: string[] = [];
      while (i < lines.length && isMdTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const dataLines = tableLines.filter((line) => !isMdSeparator(line));
      if (dataLines.length >= 1) {
        const parsed = dataLines.map(splitCells);
        const colCount = Math.max(...parsed.map((row) => row.length));
        const padded = parsed.map((row) => {
          const next = [...row];
          while (next.length < colCount) next.push("");
          return next;
        });
        blocks.push({ type: "table", headers: padded[0], rows: padded.slice(1) });
      }
      continue;
    }

    const textLines: string[] = [];
    while (i < lines.length && !isMdTableRow(lines[i])) {
      textLines.push(lines[i]);
      i += 1;
    }
    const text = textLines.join("\n").trim();
    if (text) blocks.push({ type: "text", text });
  }

  return blocks;
}

function bodyHasMarkdownTable(body: string) {
  return body.split(/\r?\n/).some(isMdTableRow);
}

function MdInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function PlaybookFormattedBody({ body }: { body: string }) {
  const blocks = parsePlaybookBlocks(body);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "table") {
          return (
            <div key={index} className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/40">
                    {block.headers.map((header, cellIndex) => (
                      <TableHead
                        key={cellIndex}
                        className={cn(cellIndex > 0 && "text-right")}
                      >
                        <MdInline text={header} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {block.rows.map((row, rowIndex) => {
                    const emphasis = row.some((cell) => cell.includes("**"))
                      || /ahorro/i.test(row[0] ?? "");
                    return (
                      <TableRow
                        key={rowIndex}
                        className={cn(emphasis && "bg-emerald-500/10 hover:bg-emerald-500/15")}
                      >
                        {row.map((cell, cellIndex) => (
                          <TableCell
                            key={cellIndex}
                            className={cn(
                              cellIndex === 0 ? "font-medium" : "text-right tabular-nums",
                              emphasis && cellIndex === row.length - 1
                                && "text-emerald-700 dark:text-emerald-300 font-semibold",
                            )}
                          >
                            {cell ? <MdInline text={cell} /> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        }

        return (
          <div key={index} className="space-y-2">
            {block.text.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
              <p
                key={paragraphIndex}
                className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap"
              >
                <MdInline text={paragraph} />
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function CrmPlaybookPanel() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CrmPlaybookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("mc_crm_playbook").select("*");
    if (error) toast.error(error.message);
    else {
      const rows = (data as CrmPlaybookEntry[]) ?? [];
      rows.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
      setItems(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (item: CrmPlaybookEntry) => {
    setSavingKey(item.key);
    const { error } = await supabase
      .from("mc_crm_playbook")
      .update({ title: item.title, body: item.body })
      .eq("key", item.key);
    setSavingKey(null);
    if (error) toast.error(error.message);
    else toast.success(t("admin.crm.playbookSaved"));
  };

  const toggleEdit = (key: string) => {
    setEditingKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => {
        const showTable = bodyHasMarkdownTable(item.body) || item.key === "roi";
        const editing = editingKeys[item.key] ?? !showTable;

        return (
          <Card
            key={item.key}
            className={cn("flex flex-col", showTable && "lg:col-span-2")}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{t(`admin.crm.playbookKeys.${item.key}`)}</CardDescription>
              </div>
              <div className="flex gap-1">
                {showTable && (
                  <Button
                    variant={editing ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1"
                    onClick={() => toggleEdit(item.key)}
                  >
                    <Pencil className="w-4 h-4" />
                    {t("admin.common.edit")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (await copyText(item.body)) toast.success(t("admin.crm.copied"));
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={savingKey === item.key}
                  onClick={() => void save(item)}
                >
                  {savingKey === item.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t("admin.common.save")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {showTable && <PlaybookFormattedBody body={item.body} />}
              {editing && (
                <Textarea
                  className={cn(
                    "font-mono text-xs leading-relaxed",
                    showTable ? "min-h-[180px]" : "min-h-[280px]",
                  )}
                  value={item.body}
                  onChange={(e) => {
                    const body = e.target.value;
                    setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, body } : p)));
                  }}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
