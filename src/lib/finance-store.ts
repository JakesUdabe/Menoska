import type { DemoOrg } from "@/lib/orgs-store";

export const EXPENSE_CATEGORIES = [
  "ai",
  "infra",
  "software",
  "personnel",
  "marketing",
  "office",
  "legal",
  "other",
] as const;

export const PAYMENT_METHODS = ["transfer", "card", "direct_debit", "paypal", "cash"] as const;

export const INVOICE_STATUSES = ["paid", "pending", "overdue", "draft"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type PlatformExpense = {
  id: string;
  date: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
};

export type PlatformInvoice = {
  id: string;
  date: string;
  dueDate: string;
  organizationId: string;
  organizationName: string;
  concept: string;
  amount: number;
  status: InvoiceStatus;
  createdAt: string;
};

const EXPENSES_KEY = "abi_platform_expenses";
const INVOICES_KEY = "abi_platform_invoices";
const SEEDED_KEY = "abi_finance_seeded_v1";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return isoDate(new Date());
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function formatEUR(amount: number, locale: string) {
  const tag = locale === "va" ? "ca" : locale;
  return new Intl.NumberFormat(tag, { style: "currency", currency: "EUR" }).format(amount);
}

export function parseAmount(raw: string) {
  const n = Number(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedExpenses(): PlatformExpense[] {
  const now = new Date();
  const thisMonth = (day: number) => isoDate(new Date(now.getFullYear(), now.getMonth(), day));
  const lastMonth = (day: number) => isoDate(new Date(now.getFullYear(), now.getMonth() - 1, day));
  const twoMonths = (day: number) => isoDate(new Date(now.getFullYear(), now.getMonth() - 2, day));
  return [
    {
      id: "exp-seed-1",
      date: thisMonth(Math.min(5, now.getDate())),
      concept: "Anthropic Claude API",
      category: "ai",
      amount: 286,
      vendor: "Anthropic",
      paymentMethod: "card",
      notes: "Generación de informes y boletines",
      createdAt: thisMonth(5),
    },
    {
      id: "exp-seed-2",
      date: thisMonth(Math.min(8, now.getDate())),
      concept: "OpenAI embeddings",
      category: "ai",
      amount: 126,
      vendor: "OpenAI",
      paymentMethod: "card",
      notes: "",
      createdAt: thisMonth(8),
    },
    {
      id: "exp-seed-3",
      date: thisMonth(1),
      concept: "Vercel Pro",
      category: "infra",
      amount: 20,
      vendor: "Vercel",
      paymentMethod: "card",
      notes: "Hosting de la plataforma",
      createdAt: thisMonth(1),
    },
    {
      id: "exp-seed-4",
      date: thisMonth(1),
      concept: "Supabase Pro",
      category: "infra",
      amount: 25,
      vendor: "Supabase",
      paymentMethod: "card",
      notes: "",
      createdAt: thisMonth(1),
    },
    {
      id: "exp-seed-5",
      date: lastMonth(12),
      concept: "Campaña LinkedIn Ads",
      category: "marketing",
      amount: 180,
      vendor: "LinkedIn",
      paymentMethod: "card",
      notes: "",
      createdAt: lastMonth(12),
    },
    {
      id: "exp-seed-6",
      date: lastMonth(3),
      concept: "Google Workspace",
      category: "software",
      amount: 14,
      vendor: "Google",
      paymentMethod: "card",
      notes: "",
      createdAt: lastMonth(3),
    },
    {
      id: "exp-seed-7",
      date: twoMonths(20),
      concept: "Asesoría fiscal trimestral",
      category: "legal",
      amount: 320,
      vendor: "Gestoría",
      paymentMethod: "transfer",
      notes: "",
      createdAt: twoMonths(20),
    },
  ];
}

function seedInvoices(orgs: DemoOrg[]): PlatformInvoice[] {
  const now = new Date();
  const items: PlatformInvoice[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const date = isoDate(d);
    const due = isoDate(new Date(d.getFullYear(), d.getMonth(), 15));
    const monthLabel = `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    for (const org of orgs) {
      if (org.mrr <= 0) continue;
      const current = i === 0;
      let status: InvoiceStatus = "paid";
      if (current && org.status === "trialing") status = "pending";
      if (current && org.status === "past_due") status = "overdue";
      items.push({
        id: `inv-seed-${org.id}-${monthKey(date)}`,
        date,
        dueDate: due,
        organizationId: org.id,
        organizationName: org.name,
        concept: `Suscripción ${org.plan} · ${monthLabel}`,
        amount: org.mrr,
        status,
        createdAt: date,
      });
    }
  }
  return items;
}

export function ensureFinanceSeed(orgs: DemoOrg[]) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (!localStorage.getItem(EXPENSES_KEY)) writeJson(EXPENSES_KEY, seedExpenses());
  if (!localStorage.getItem(INVOICES_KEY)) writeJson(INVOICES_KEY, seedInvoices(orgs));
  localStorage.setItem(SEEDED_KEY, "1");
}

export function listExpenses(): PlatformExpense[] {
  return readJson<PlatformExpense[]>(EXPENSES_KEY, []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function listInvoices(): PlatformInvoice[] {
  return readJson<PlatformInvoice[]>(INVOICES_KEY, []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function saveExpense(input: Omit<PlatformExpense, "id" | "createdAt"> & { id?: string }): PlatformExpense {
  const items = listExpenses();
  const existing = input.id ? items.find((e) => e.id === input.id) : undefined;
  const next: PlatformExpense = {
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
  };
  const updated = existing ? items.map((e) => (e.id === existing.id ? next : e)) : [next, ...items];
  writeJson(EXPENSES_KEY, updated);
  return next;
}

export function deleteExpense(id: string) {
  writeJson(
    EXPENSES_KEY,
    listExpenses().filter((e) => e.id !== id),
  );
}

export function saveInvoice(input: Omit<PlatformInvoice, "id" | "createdAt"> & { id?: string }): PlatformInvoice {
  const items = listInvoices();
  const existing = input.id ? items.find((e) => e.id === input.id) : undefined;
  const next: PlatformInvoice = {
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
  };
  const updated = existing ? items.map((e) => (e.id === existing.id ? next : e)) : [next, ...items];
  writeJson(INVOICES_KEY, updated);
  return next;
}

export function deleteInvoice(id: string) {
  writeJson(
    INVOICES_KEY,
    listInvoices().filter((e) => e.id !== id),
  );
}

export type FinancePeriod = "month" | "year" | "12m";

export function inPeriod(date: string, period: FinancePeriod) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "month") {
    return monthKey(date) === `${y}-${pad(m + 1)}`;
  }
  if (period === "year") {
    return date.startsWith(`${y}-`);
  }
  const from = new Date(y, m - 11, 1);
  return date >= isoDate(from);
}

export function lastMonths(count: number): { key: string; label: string }[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: `${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`,
    });
  }
  return months;
}
