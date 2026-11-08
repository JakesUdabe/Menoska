"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Flame, Plus,
  Pencil, Trash2, Loader2, BarChart3, RefreshCw, LayoutDashboard, Receipt,
  Calculator,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invokeAdminFunction } from "@/lib/admin/use-admin-data";
import type { Expense, ExpenseCategory, ExpenseProvider, StripeFinancials } from "@/lib/admin/types";
import { DA_CATEGORIES, OPEX_CATEGORIES } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "recurrent", "payroll", "one_time", "interest", "tax", "depreciation", "amortization",
];
const MANUAL_PROVIDERS: ExpenseProvider[] = ["manual", "hetzner", "cloudflare"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function formatCurrency(n: number, lang: string): string {
  const localeMap: Record<string, string> = {
    es: "es-ES", en: "en-US", eu: "eu-ES", gl: "gl-ES", ca: "ca-ES",
  };
  const locale = localeMap[lang.split("-")[0]] ?? "es-ES";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(n);
}

function inYear(date: string | null | undefined, year: number): boolean {
  return !!date && date.startsWith(String(year));
}

function sumBy(
  items: Expense[],
  pred: (e: Expense) => boolean,
): number {
  return items.filter(pred).reduce((s, e) => s + Number(e.amount), 0);
}

export default function AdminFinanzasPage() {
  const { t, i18n } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [financials, setFinancials] = useState<StripeFinancials | null>(null);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fmt = useCallback((n: number) => formatCurrency(n, i18n.language), [i18n.language]);
  const emDash = t("admin.convocatoriasPage.emDash");

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase
      .from("mc_expenses")
      .select("*")
      .order("billing_date", { ascending: false })
      .limit(2000);
    if (error) throw error;
    setExpenses((data as Expense[]) ?? []);
  }, []);

  const fetchStripe = useCallback(async (year: number) => {
    setStripeLoading(true);
    try {
      const data = await invokeAdminFunction<StripeFinancials & { ok?: boolean }>(
        "menoska-get-stripe-financials",
        t("admin.finanzas.stripeError"),
        { year },
      );
      setFinancials(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.finanzas.stripeErrorShort"));
    } finally {
      setStripeLoading(false);
    }
  }, [t]);

  const syncOpenai = useCallback(async () => {
    setOpenaiLoading(true);
    try {
      const data = await invokeAdminFunction<{ ok?: boolean; upserted?: number }>(
        "menoska-sync-openai-costs",
        t("admin.finanzas.openaiError"),
      );
      toast.success(t("admin.finanzas.openaiSynced", { count: data.upserted ?? 0 }));
      await fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.finanzas.openaiErrorShort"));
    } finally {
      setOpenaiLoading(false);
    }
  }, [fetchExpenses, t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await fetchExpenses();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("admin.finanzas.loadExpensesError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchExpenses, t]);

  useEffect(() => {
    void fetchStripe(selectedYear);
  }, [fetchStripe, selectedYear]);

  const yearExpenses = useMemo(
    () => expenses.filter((e) => inYear(e.billing_date || e.expense_date, selectedYear)),
    [expenses, selectedYear],
  );

  const yearRevenue = financials?.yearRevenue
    ?? financials?.monthlyBreakdown?.reduce((s, m) => s + m.revenue, 0)
    ?? 0;

  const opex = useMemo(
    () => sumBy(yearExpenses, (e) => OPEX_CATEGORIES.includes(e.category)),
    [yearExpenses],
  );
  const da = useMemo(
    () => sumBy(yearExpenses, (e) => DA_CATEGORIES.includes(e.category)),
    [yearExpenses],
  );
  const interest = useMemo(
    () => sumBy(yearExpenses, (e) => e.category === "interest"),
    [yearExpenses],
  );
  const tax = useMemo(
    () => sumBy(yearExpenses, (e) => e.category === "tax"),
    [yearExpenses],
  );

  const ebitda = yearRevenue - opex;
  const ebit = ebitda - da;
  const ebt = ebit - interest;
  const netIncome = ebt - tax;
  const ebitdaMargin = yearRevenue > 0 ? (ebitda / yearRevenue) * 100 : 0;

  const monthlyExpensesBreakdown = useMemo(() => {
    const months: { month: string; amount: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
      const amount = expenses
        .filter((e) => (e.billing_date || e.expense_date).startsWith(key))
        .reduce((s, e) => s + Number(e.amount), 0);
      months.push({ month: key, amount });
    }
    return months;
  }, [expenses, selectedYear]);

  const dashboardChartMax = useMemo(() => {
    const revenueMax = Math.max(...(financials?.monthlyBreakdown?.map((m) => m.revenue) ?? [0]), 0);
    const expensesMax = Math.max(...monthlyExpensesBreakdown.map((m) => m.amount), 0);
    return Math.max(revenueMax, expensesMax, 1);
  }, [financials?.monthlyBreakdown, monthlyExpensesBreakdown]);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyExpenses = useMemo(
    () => expenses
      .filter((e) => (e.billing_date || e.expense_date).startsWith(monthKey))
      .reduce((s, e) => s + Number(e.amount), 0),
    [expenses, monthKey],
  );

  const revenue = financials?.currentMonthRevenue ?? 0;
  const netProfit = revenue - monthlyExpenses;
  const burnRate = monthlyExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const totalYearExpenses = useMemo(
    () => yearExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [yearExpenses],
  );

  const saveExpense = async (data: Partial<Expense> & { id?: string }) => {
    try {
      const payload = {
        title: data.title,
        amount: data.amount,
        category: data.category,
        expense_date: data.expense_date ?? data.billing_date,
        billing_date: data.billing_date ?? data.expense_date,
        payment_date: data.payment_date || null,
        external_id: data.external_id?.trim() || null,
        description: data.description,
        provider: data.provider ?? "manual",
      };
      if (data.id) {
        const { error } = await supabase.from("mc_expenses").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("mc_expenses").insert({
          ...payload,
          title: data.title!,
          amount: data.amount!,
          category: data.category!,
          expense_date: payload.expense_date!,
          billing_date: payload.billing_date!,
          created_by: user?.id,
        });
        if (error) throw error;
      }
      toast.success(t("admin.finanzas.saved"));
      setShowDialog(false);
      setEditExpense(null);
      await fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    }
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("mc_expenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deleted")); await fetchExpenses(); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t("admin.finanzas.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("admin.finanzas.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="finanzas-year" className="text-sm text-muted-foreground whitespace-nowrap">
            {t("admin.finanzas.yearFilter")}
          </Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger id="finanzas-year" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="w-4 h-4" /> {t("admin.finanzas.tabDashboard")}
          </TabsTrigger>
          <TabsTrigger value="ebitda" className="gap-2">
            <Calculator className="w-4 h-4" /> {t("admin.finanzas.tabEbitda")}
          </TabsTrigger>
          <TabsTrigger value="gastos" className="gap-2">
            <Receipt className="w-4 h-4" /> {t("admin.finanzas.tabExpenses")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => fetchStripe(selectedYear)} disabled={stripeLoading} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", stripeLoading && "animate-spin")} />
              {t("admin.finanzas.refreshStripe")}
            </Button>
            <Button variant="outline" size="sm" onClick={syncOpenai} disabled={openaiLoading} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", openaiLoading && "animate-spin")} />
              {t("admin.finanzas.syncOpenai")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpi
              icon={DollarSign}
              label={t("admin.finanzas.revenueMonth")}
              value={fmt(revenue)}
              trend={financials ? revenue - (financials.previousMonthRevenue ?? 0) : 0}
              color="text-emerald-500"
              fmt={fmt}
              vsPrevLabel={t("admin.finanzas.vsPrevMonth")}
            />
            <FinanceKpi
              icon={TrendingDown}
              label={t("admin.finanzas.expensesMonth")}
              value={fmt(monthlyExpenses)}
              color="text-red-500"
              fmt={fmt}
              vsPrevLabel={t("admin.finanzas.vsPrevMonth")}
            />
            <FinanceKpi
              icon={TrendingUp}
              label={t("admin.finanzas.netProfit")}
              value={fmt(netProfit)}
              sub={t("admin.finanzas.margin", { value: profitMargin.toFixed(1) })}
              color={netProfit >= 0 ? "text-emerald-500" : "text-red-500"}
              fmt={fmt}
              vsPrevLabel={t("admin.finanzas.vsPrevMonth")}
            />
            <FinanceKpi
              icon={Flame}
              label={t("admin.finanzas.burnRate")}
              value={fmt(burnRate)}
              sub={t("admin.finanzas.forecast", { value: fmt(financials?.forecastRevenue ?? 0) })}
              color="text-amber-500"
              fmt={fmt}
              vsPrevLabel={t("admin.finanzas.vsPrevMonth")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {financials?.monthlyBreakdown && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" /> {t("admin.finanzas.stripeChartYear", { year: selectedYear })}
                  </CardTitle>
                  <CardDescription>{t("admin.finanzas.stripeChartDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <MonthBars
                    items={financials.monthlyBreakdown.map((m) => ({ key: m.month, value: m.revenue }))}
                    fmt={fmt}
                    barClass="bg-primary/80"
                    maxValue={dashboardChartMax}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" /> {t("admin.finanzas.expensesChartYear", { year: selectedYear })}
                </CardTitle>
                <CardDescription>{t("admin.finanzas.expensesChartDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthBars
                  items={monthlyExpensesBreakdown.map((m) => ({ key: m.month, value: m.amount }))}
                  fmt={fmt}
                  barClass="bg-red-500/80"
                  maxValue={dashboardChartMax}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ebitda" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.finanzas.ebitdaTitle", { year: selectedYear })}</CardTitle>
              <CardDescription>{t("admin.finanzas.ebitdaDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FinanceKpi icon={DollarSign} label={t("admin.finanzas.revenueYear")} value={fmt(yearRevenue)} color="text-emerald-500" fmt={fmt} vsPrevLabel="" />
                <FinanceKpi icon={TrendingDown} label={t("admin.finanzas.opex")} value={fmt(opex)} color="text-red-500" fmt={fmt} vsPrevLabel="" />
                <FinanceKpi
                  icon={Calculator}
                  label="EBITDA"
                  value={fmt(ebitda)}
                  sub={t("admin.finanzas.margin", { value: ebitdaMargin.toFixed(1) })}
                  color={ebitda >= 0 ? "text-emerald-500" : "text-red-500"}
                  fmt={fmt}
                  vsPrevLabel=""
                />
                <FinanceKpi
                  icon={TrendingUp}
                  label={t("admin.finanzas.netIncome")}
                  value={fmt(netIncome)}
                  color={netIncome >= 0 ? "text-emerald-500" : "text-red-500"}
                  fmt={fmt}
                  vsPrevLabel=""
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.finanzas.calcConcept")}</TableHead>
                    <TableHead className="text-right">{t("admin.finanzas.tableAmount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CalcRow label={t("admin.finanzas.revenueYear")} amount={yearRevenue} fmt={fmt} />
                  <CalcRow label={`− ${t("admin.finanzas.opex")}`} amount={-opex} fmt={fmt} muted />
                  <CalcRow label="EBITDA" amount={ebitda} fmt={fmt} bold />
                  <CalcRow label={`− ${t("admin.finanzas.da")}`} amount={-da} fmt={fmt} muted />
                  <CalcRow label="EBIT" amount={ebit} fmt={fmt} bold />
                  <CalcRow label={`− ${t("admin.finanzas.interest")}`} amount={-interest} fmt={fmt} muted />
                  <CalcRow label="EBT" amount={ebt} fmt={fmt} bold />
                  <CalcRow label={`− ${t("admin.finanzas.tax")}`} amount={-tax} fmt={fmt} muted />
                  <CalcRow label={t("admin.finanzas.netIncome")} amount={netIncome} fmt={fmt} bold />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("admin.finanzas.manageExpenses")}</CardTitle>
                <CardDescription>
                  {t("admin.finanzas.totalYear", { year: selectedYear, value: fmt(totalYearExpenses) })}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={syncOpenai} disabled={openaiLoading} className="gap-2">
                  <RefreshCw className={cn("w-4 h-4", openaiLoading && "animate-spin")} />
                  {t("admin.finanzas.syncOpenai")}
                </Button>
                <Button size="sm" className="gap-1" onClick={() => { setEditExpense(null); setShowDialog(true); }}>
                  <Plus className="w-4 h-4" /> {t("admin.finanzas.newExpense")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.finanzas.tableId")}</TableHead>
                    <TableHead>{t("admin.finanzas.tableTitle")}</TableHead>
                    <TableHead>{t("admin.finanzas.tableProvider")}</TableHead>
                    <TableHead>{t("admin.finanzas.tableCategory")}</TableHead>
                    <TableHead>{t("admin.finanzas.tableBillingDate")}</TableHead>
                    <TableHead>{t("admin.finanzas.tablePaymentDate")}</TableHead>
                    <TableHead className="text-right">{t("admin.finanzas.tableAmount")}</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">
                        {e.external_id ?? e.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{e.title}</p>
                          {e.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{e.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`admin.expenseProviders.${e.provider}`, { defaultValue: e.provider })}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`admin.expenseCategories.${e.category}`)}</Badge>
                      </TableCell>
                      <TableCell>{e.billing_date || e.expense_date}</TableCell>
                      <TableCell>{e.payment_date ?? emDash}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(e.amount))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditExpense(e); setShowDialog(true); }}
                            disabled={e.provider === "openai"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteExpense(e.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {yearExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t("admin.finanzas.noExpensesYear", { year: selectedYear })}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showDialog && (
        <ExpenseDialog
          expense={editExpense}
          onClose={() => { setShowDialog(false); setEditExpense(null); }}
          onSave={saveExpense}
        />
      )}
    </div>
  );
}

function MonthBars({
  items, fmt, barClass, maxValue,
}: {
  items: { key: string; value: number }[];
  fmt: (n: number) => string;
  barClass: string;
  /** Shared Y scale across sibling charts (defaults to this series' max). */
  maxValue?: number;
}) {
  const seriesMax = Math.max(...items.map((x) => x.value), 0);
  const max = Math.max(maxValue ?? 0, seriesMax, 1);

  return (
    <div className="flex gap-1.5 h-44">
      {items.map((m) => {
        const pct = Math.max(0, Math.min(100, (m.value / max) * 100));
        return (
          <div key={m.key} className="flex-1 flex flex-col min-w-0 h-full">
            <span className="text-[9px] text-muted-foreground truncate text-center mb-1 shrink-0">
              {fmt(m.value)}
            </span>
            <div className="relative flex-1 w-full min-h-0">
              {m.value > 0 && (
                <div
                  className={cn("absolute inset-x-0 bottom-0 rounded-t-md transition-all", barClass)}
                  style={{ height: `${pct}%` }}
                  title={fmt(m.value)}
                />
              )}
            </div>
            <span className="text-[10px] font-medium text-center mt-1 shrink-0">{m.key.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CalcRow({
  label, amount, fmt, bold, muted,
}: {
  label: string;
  amount: number;
  fmt: (n: number) => string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <TableRow className={bold ? "bg-muted/40" : undefined}>
      <TableCell className={cn(bold && "font-semibold", muted && "text-muted-foreground")}>{label}</TableCell>
      <TableCell className={cn("text-right font-mono", bold && "font-semibold", amount < 0 && "text-red-500")}>
        {fmt(amount)}
      </TableCell>
    </TableRow>
  );
}

function FinanceKpi({
  icon: Icon, label, value, sub, trend, color, fmt, vsPrevLabel,
}: {
  icon: typeof DollarSign; label: string; value: string;
  sub?: string; trend?: number; color?: string;
  fmt: (n: number) => string; vsPrevLabel: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className={cn("w-4 h-4", color)} />
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className={cn("text-2xl font-bold", color)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend !== undefined && trend !== 0 && vsPrevLabel && (
          <p className={cn("text-xs mt-1", trend > 0 ? "text-emerald-500" : "text-red-500")}>
            {trend > 0 ? "+" : ""}{fmt(trend)} {vsPrevLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  expense, onClose, onSave,
}: {
  expense: Expense | null;
  onClose: () => void;
  onSave: (data: Partial<Expense> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "one_time");
  const [provider, setProvider] = useState<ExpenseProvider>(
    expense?.provider && MANUAL_PROVIDERS.includes(expense.provider) ? expense.provider : "manual",
  );
  const [externalId, setExternalId] = useState(expense?.external_id ?? "");
  const [billingDate, setBillingDate] = useState(expense?.billing_date ?? expense?.expense_date ?? today);
  const [paymentDate, setPaymentDate] = useState(expense?.payment_date ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? t("admin.finanzas.editExpense") : t("admin.finanzas.newExpense")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("admin.common.title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>{t("admin.common.amount")}</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>{t("admin.finanzas.tableId")}</Label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="INV-001" />
          </div>
          <div>
            <Label>{t("admin.finanzas.tableProvider")}</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ExpenseProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANUAL_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`admin.expenseProviders.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("admin.common.category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((k) => (
                  <SelectItem key={k} value={k}>{t(`admin.expenseCategories.${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("admin.finanzas.categoryHint")}</p>
          </div>
          <div>
            <Label>{t("admin.finanzas.tableBillingDate")}</Label>
            <Input type="date" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">{t("admin.finanzas.billingDateHint")}</p>
          </div>
          <div>
            <Label>{t("admin.finanzas.tablePaymentDate")}</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">{t("admin.finanzas.paymentDateHint")}</p>
          </div>
          <div><Label>{t("admin.common.description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSave({
            id: expense?.id,
            title,
            amount: parseFloat(amount),
            category,
            external_id: externalId,
            billing_date: billingDate,
            expense_date: billingDate,
            payment_date: paymentDate || null,
            description,
            provider,
          })}>{t("admin.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
