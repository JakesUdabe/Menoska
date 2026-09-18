"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { isSuperAdmin } from "@/lib/rbac";
import { listOrgs, type DemoOrg } from "@/lib/orgs-store";
import {
  deleteExpense,
  deleteInvoice,
  ensureFinanceSeed,
  EXPENSE_CATEGORIES,
  formatEUR,
  inPeriod,
  INVOICE_STATUSES,
  lastMonths,
  listExpenses,
  listInvoices,
  monthKey,
  parseAmount,
  PAYMENT_METHODS,
  saveExpense,
  saveInvoice,
  todayIso,
  type ExpenseCategory,
  type FinancePeriod,
  type InvoiceStatus,
  type PaymentMethod,
  type PlatformExpense,
  type PlatformInvoice,
} from "@/lib/finance-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm";

const CAT_COLORS: Record<ExpenseCategory, string> = {
  ai: "#4f6bed",
  infra: "#2f9d8a",
  software: "#7c5cbf",
  personnel: "#c45c26",
  marketing: "#c23b6e",
  office: "#5a6a7a",
  legal: "#8a6d3b",
  other: "#6b7280",
};

type ExpenseForm = {
  id?: string;
  date: string;
  concept: string;
  category: ExpenseCategory;
  amount: string;
  vendor: string;
  paymentMethod: PaymentMethod;
  notes: string;
};

type InvoiceForm = {
  id?: string;
  date: string;
  dueDate: string;
  organizationId: string;
  concept: string;
  amount: string;
  status: InvoiceStatus;
};

function emptyExpense(): ExpenseForm {
  return {
    date: todayIso(),
    concept: "",
    category: "other",
    amount: "",
    vendor: "",
    paymentMethod: "card",
    notes: "",
  };
}

function emptyInvoice(orgs: DemoOrg[]): InvoiceForm {
  return {
    date: todayIso(),
    dueDate: todayIso(),
    organizationId: orgs[0]?.id ?? "",
    concept: "",
    amount: "",
    status: "pending",
  };
}

function shiftPeriod(period: FinancePeriod): (date: string) => boolean {
  const now = new Date();
  if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const key = monthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    return (date) => monthKey(date) === key;
  }
  if (period === "year") {
    return (date) => date.startsWith(`${now.getFullYear() - 1}-`);
  }
  const from = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - 11, 0);
  const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`;
  const toIso = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
  return (date) => date >= fromIso && date <= toIso;
}

function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function AdminFinance() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<DemoOrg[]>([]);
  const [expenses, setExpenses] = useState<PlatformExpense[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(emptyInvoice([]));

  function reload(nextOrgs?: DemoOrg[]) {
    const allOrgs = nextOrgs ?? listOrgs();
    const visibleOrgs = isSuperAdmin(user?.role) ? allOrgs : allOrgs.filter((o) => o.id === user?.organizationId);
    setOrgs(visibleOrgs);
    setExpenses(listExpenses());
    const allInvoices = listInvoices();
    setInvoices(
      isSuperAdmin(user?.role) ? allInvoices : allInvoices.filter((i) => i.organizationId === user?.organizationId),
    );
  }

  useEffect(() => {
    const all = listOrgs();
    ensureFinanceSeed(all);
    reload(all);
    setInvoiceForm(emptyInvoice(isSuperAdmin(user?.role) ? all : all.filter((o) => o.id === user?.organizationId)));
  }, [user]);

  const periodInvoices = useMemo(() => invoices.filter((i) => inPeriod(i.date, period)), [invoices, period]);
  const periodExpenses = useMemo(() => expenses.filter((e) => inPeriod(e.date, period)), [expenses, period]);
  const prevFilter = useMemo(() => shiftPeriod(period), [period]);
  const prevInvoices = useMemo(() => invoices.filter((i) => prevFilter(i.date)), [invoices, prevFilter]);
  const prevExpenses = useMemo(() => expenses.filter((e) => prevFilter(e.date)), [expenses, prevFilter]);

  const paid = (items: PlatformInvoice[]) => items.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const income = paid(periodInvoices);
  const expenseTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const result = income - expenseTotal;
  const prevIncome = paid(prevInvoices);
  const prevExpenseTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const prevResult = prevIncome - prevExpenseTotal;
  const pending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const mrr = orgs.reduce((s, o) => s + o.mrr, 0);
  const arr = mrr * 12;
  const margin = income === 0 ? 0 : (result / income) * 100;

  const monthly = useMemo(() => {
    const months = lastMonths(12);
    return months.map((m) => {
      const inc = invoices.filter((i) => i.status === "paid" && monthKey(i.date) === m.key).reduce((s, i) => s + i.amount, 0);
      const exp = expenses.filter((e) => monthKey(e.date) === m.key).reduce((s, e) => s + e.amount, 0);
      return { ...m, income: inc, expense: exp, result: inc - exp };
    });
  }, [invoices, expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of periodExpenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return EXPENSE_CATEGORIES.filter((c) => (map.get(c) ?? 0) > 0).map((c) => ({
      key: c,
      name: t(`finance.cat.${c}`),
      value: map.get(c) ?? 0,
    }));
  }, [periodExpenses, t]);

  const byOrg = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of periodInvoices.filter((x) => x.status === "paid")) {
      map.set(i.organizationName, (map.get(i.organizationName) ?? 0) + i.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [periodInvoices]);

  function money(n: number) {
    return formatEUR(n, locale);
  }

  function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(expenseForm.amount);
    if (!expenseForm.concept.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error(t("finance.invalidExpense"));
      return;
    }
    saveExpense({
      id: expenseForm.id,
      date: expenseForm.date,
      concept: expenseForm.concept.trim(),
      category: expenseForm.category,
      amount,
      vendor: expenseForm.vendor.trim(),
      paymentMethod: expenseForm.paymentMethod,
      notes: expenseForm.notes.trim(),
    });
    toast.success(expenseForm.id ? t("finance.expenseUpdated") : t("finance.expenseSaved"));
    setExpenseForm(emptyExpense());
    reload();
  }

  function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(invoiceForm.amount);
    const org = orgs.find((o) => o.id === invoiceForm.organizationId);
    if (!invoiceForm.concept.trim() || !Number.isFinite(amount) || amount <= 0 || !org) {
      toast.error(t("finance.invalidInvoice"));
      return;
    }
    saveInvoice({
      id: invoiceForm.id,
      date: invoiceForm.date,
      dueDate: invoiceForm.dueDate || invoiceForm.date,
      organizationId: org.id,
      organizationName: org.name,
      concept: invoiceForm.concept.trim(),
      amount,
      status: invoiceForm.status,
    });
    toast.success(invoiceForm.id ? t("finance.invoiceUpdated") : t("finance.invoiceSaved"));
    setInvoiceForm(emptyInvoice(orgs));
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.billing")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("finance.lead")}</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="dashboard">{t("finance.tabDashboard")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("finance.tabInvoices")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("finance.tabExpenses")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 pt-4">
          <div className="flex flex-wrap gap-2">
            {(["month", "year", "12m"] as FinancePeriod[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
                {t(`finance.period.${p}`)}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title={t("finance.income")}
              value={money(income)}
              delta={deltaPct(income, prevIncome)}
              positive
            />
            <KpiCard
              title={t("finance.expenses")}
              value={money(expenseTotal)}
              delta={deltaPct(expenseTotal, prevExpenseTotal)}
              positive={false}
            />
            <KpiCard
              title={t("finance.result")}
              value={money(result)}
              delta={deltaPct(result, prevResult)}
              positive
              emphasize={result < 0}
            />
            <KpiCard title={t("admin.mrr")} value={money(mrr)} subtitle={`${t("finance.arr")} ${money(arr)}`} />
            <KpiCard title={t("finance.margin")} value={`${margin.toFixed(1)} %`} />
            <KpiCard
              title={t("finance.outstanding")}
              value={money(pending + overdue)}
              subtitle={`${t("finance.status.pending")} ${money(pending)} · ${t("finance.status.overdue")} ${money(overdue)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("finance.trend")}</CardTitle>
              <CardDescription>{t("finance.trendLead")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                      formatter={(value) => money(Number(value ?? 0))}
                    />
                    <Legend />
                    <Bar dataKey="income" name={t("finance.income")} fill="#2d4a7c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name={t("finance.expenses")} fill="#b42318" radius={[4, 4, 0, 0]} />
                    <Line dataKey="result" name={t("finance.result")} stroke="#2f9d8a" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("finance.byCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("finance.noExpensesPeriod")}</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                            {byCategory.map((c) => (
                              <Cell key={c.key} fill={CAT_COLORS[c.key as ExpenseCategory]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {byCategory.map((c) => (
                        <li key={c.key} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ background: CAT_COLORS[c.key as ExpenseCategory] }} />
                            {c.name}
                          </span>
                          <span className="font-medium">{money(c.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("finance.byOrg")}</CardTitle>
              </CardHeader>
              <CardContent>
                {byOrg.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("finance.noInvoicesPeriod")}</p>
                ) : (
                  <ul className="space-y-3">
                    {byOrg.map(([name, amount]) => (
                      <li key={name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{name}</span>
                          <span className="font-medium">{money(amount)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${income > 0 ? Math.max(6, (amount / income) * 100) : 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("finance.recent")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.date")}</TableHead>
                    <TableHead>{t("finance.type")}</TableHead>
                    <TableHead>{t("finance.concept")}</TableHead>
                    <TableHead className="text-right">{t("finance.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...periodInvoices.map((i) => ({
                      id: i.id,
                      date: i.date,
                      type: "invoice" as const,
                      concept: `${i.organizationName} · ${i.concept}`,
                      amount: i.amount,
                    })),
                    ...periodExpenses.map((e) => ({
                      id: e.id,
                      date: e.date,
                      type: "expense" as const,
                      concept: e.concept,
                      amount: -e.amount,
                    })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 8)
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                        <TableCell>
                          <Badge variant={row.type === "invoice" ? "secondary" : "outline"}>
                            {row.type === "invoice" ? t("finance.tabInvoices") : t("finance.tabExpenses")}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.concept}</TableCell>
                        <TableCell className={cn("text-right font-medium", row.amount < 0 && "text-destructive")}>
                          {money(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {invoiceForm.id ? t("finance.editInvoice") : t("finance.addInvoice")}
              </CardTitle>
              <CardDescription>{t("finance.addInvoiceLead")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitInvoice}>
                <div>
                  <Label>{t("admin.orgs")}</Label>
                  <select
                    className={selectClass}
                    value={invoiceForm.organizationId}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, organizationId: e.target.value }))}
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("finance.concept")}</Label>
                  <Input
                    value={invoiceForm.concept}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, concept: e.target.value }))}
                    placeholder={t("finance.invoicePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("finance.amount")}</Label>
                  <Input
                    inputMode="decimal"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>{t("finance.date")}</Label>
                  <Input type="date" value={invoiceForm.date} onChange={(e) => setInvoiceForm((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("finance.dueDate")}</Label>
                  <Input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("finance.statusLabel")}</Label>
                  <select
                    className={selectClass}
                    value={invoiceForm.status}
                    onChange={(e) => setInvoiceForm((p) => ({ ...p, status: e.target.value as InvoiceStatus }))}
                  >
                    {INVOICE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`finance.status.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="submit">
                    <Plus className="size-4" />
                    {invoiceForm.id ? t("common.save") : t("finance.registerInvoice")}
                  </Button>
                  {invoiceForm.id ? (
                    <Button type="button" variant="outline" onClick={() => setInvoiceForm(emptyInvoice(orgs))}>
                      {t("common.cancel")}
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <MiniStat label={t("admin.mrr")} value={money(mrr)} />
            <MiniStat label={t("finance.status.pending")} value={money(pending)} />
            <MiniStat label={t("finance.status.overdue")} value={money(overdue)} />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.date")}</TableHead>
                <TableHead>{t("admin.orgs")}</TableHead>
                <TableHead>{t("finance.concept")}</TableHead>
                <TableHead>{t("finance.statusLabel")}</TableHead>
                <TableHead className="text-right">{t("finance.amount")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    {t("finance.noInvoices")}
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap">{i.date}</TableCell>
                    <TableCell>{i.organizationName}</TableCell>
                    <TableCell>{i.concept}</TableCell>
                    <TableCell>
                      <Badge variant={i.status === "overdue" ? "destructive" : i.status === "paid" ? "default" : "secondary"}>
                        {t(`finance.status.${i.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(i.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setInvoiceForm({
                            id: i.id,
                            date: i.date,
                            dueDate: i.dueDate,
                            organizationId: i.organizationId,
                            concept: i.concept,
                            amount: String(i.amount),
                            status: i.status,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          deleteInvoice(i.id);
                          toast.success(t("finance.invoiceDeleted"));
                          reload();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {expenseForm.id ? t("finance.editExpense") : t("finance.addExpense")}
              </CardTitle>
              <CardDescription>{t("finance.addExpenseLead")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitExpense}>
                <div>
                  <Label>{t("finance.date")}</Label>
                  <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("finance.concept")}</Label>
                  <Input
                    value={expenseForm.concept}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, concept: e.target.value }))}
                    placeholder={t("finance.expensePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("finance.amount")}</Label>
                  <Input
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>{t("finance.category")}</Label>
                  <select
                    className={selectClass}
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value as ExpenseCategory }))}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`finance.cat.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("finance.vendor")}</Label>
                  <Input
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, vendor: e.target.value }))}
                    placeholder={t("finance.vendorPlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("finance.payment")}</Label>
                  <select
                    className={selectClass}
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, paymentMethod: e.target.value as PaymentMethod }))}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`finance.pay.${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <Label>{t("finance.notes")}</Label>
                  <Textarea
                    rows={2}
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit">
                    <Plus className="size-4" />
                    {expenseForm.id ? t("common.save") : t("finance.registerExpense")}
                  </Button>
                  {expenseForm.id ? (
                    <Button type="button" variant="outline" onClick={() => setExpenseForm(emptyExpense())}>
                      {t("common.cancel")}
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <MiniStat label={t("finance.expensesMonth")} value={money(expenses.filter((e) => inPeriod(e.date, "month")).reduce((s, e) => s + e.amount, 0))} />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.date")}</TableHead>
                <TableHead>{t("finance.concept")}</TableHead>
                <TableHead>{t("finance.category")}</TableHead>
                <TableHead>{t("finance.vendor")}</TableHead>
                <TableHead className="text-right">{t("finance.amount")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    {t("finance.noExpenses")}
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                    <TableCell>
                      {e.concept}
                      {e.notes ? <span className="block text-xs text-muted-foreground">{e.notes}</span> : null}
                    </TableCell>
                    <TableCell>{t(`finance.cat.${e.category}`)}</TableCell>
                    <TableCell>{e.vendor || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{money(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setExpenseForm({
                            id: e.id,
                            date: e.date,
                            concept: e.concept,
                            category: e.category,
                            amount: String(e.amount),
                            vendor: e.vendor,
                            paymentMethod: e.paymentMethod,
                            notes: e.notes,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          deleteExpense(e.id);
                          toast.success(t("finance.expenseDeleted"));
                          reload();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  positive,
  subtitle,
  emphasize,
}: {
  title: string;
  value: string;
  delta?: number;
  positive?: boolean;
  subtitle?: string;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tracking-tight", emphasize && "text-destructive")}>{value}</p>
        {delta != null ? (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              (positive ? delta >= 0 : delta <= 0) ? "text-emerald-700" : "text-destructive",
            )}
          >
            {(positive ? delta >= 0 : delta <= 0) ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} %
          </p>
        ) : subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
