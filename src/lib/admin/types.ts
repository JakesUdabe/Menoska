export type ExpenseCategory =
  | "recurrent"
  | "payroll"
  | "one_time"
  | "interest"
  | "tax"
  | "depreciation"
  | "amortization";
export type AbsenceType = "vacation" | "sick_leave" | "maternity" | "justified" | "pending";
export type AbsenceStatus = "pending" | "approved" | "rejected";
export type LeadPhase = "nuevo" | "contactado" | "propuesta" | "negociacion" | "convertido" | "perdido";
export type IncidentPriority = "baja" | "media" | "alta" | "critica";
export type IncidentStatus = "abierta" | "en_progreso" | "resuelta" | "cerrada";

export interface TimeEntry {
  id: string;
  user_id: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export interface AbsenceRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  absence_type: AbsenceType;
  status: AbsenceStatus;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  profiles?: { full_name: string | null } | null;
}

export interface Festivo {
  id: string;
  fecha: string;
  nombre: string;
  created_by: string | null;
  created_at?: string;
}

export type ExpenseProvider = "manual" | "openai" | "hetzner" | "cloudflare";

/** Operating expense categories (included in EBITDA). */
export const OPEX_CATEGORIES: ExpenseCategory[] = ["recurrent", "payroll", "one_time"];
/** Depreciation & amortization (excluded from EBITDA, subtracted for EBIT). */
export const DA_CATEGORIES: ExpenseCategory[] = ["depreciation", "amortization"];

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  billing_date: string;
  payment_date: string | null;
  external_id: string | null;
  provider: ExpenseProvider;
  description: string | null;
  created_by: string | null;
}

export type CreditRewardStatus = "pending" | "accepted" | "cancelled";

export type CrmRewardKind = "credits" | "resoluciones" | "partners";

export type FeatureAccessModule = "resoluciones" | "partners";

export interface CreditReward {
  id: string;
  user_id: string;
  amount: number;
  message: string;
  status: CreditRewardStatus;
  created_by: string | null;
  created_at: string;
  accepted_at: string | null;
  /** Enriched client-side from profiles / search */
  recipient?: {
    full_name: string;
    company_name: string;
    email: string;
  } | null;
}

export interface FeatureAccessReward {
  id: string;
  user_id: string;
  module: FeatureAccessModule;
  expires_at: string;
  message: string;
  status: CreditRewardStatus;
  created_by: string | null;
  created_at: string;
  accepted_at: string | null;
  recipient?: {
    full_name: string;
    company_name: string;
    email: string;
  } | null;
}

/** Unified row for CRM recent-rewards list */
export type CrmRewardListItem =
  | ({ kind: "credits" } & CreditReward)
  | ({ kind: "resoluciones" } & FeatureAccessReward)
  | ({ kind: "partners" } & FeatureAccessReward);

export interface ClienteProfileHit {
  user_id: string;
  full_name: string;
  company_name: string;
  email: string;
}

/** Platform client from public.profiles (role = cliente) for CRM Clients tab */
export interface CrmPlatformClient {
  user_id: string;
  full_name: string;
  company_name: string;
  email: string;
  plan_type: "free" | "pro" | "business" | string;
  created_at: string;
}

/** @deprecated Lead A/B/C priorities removed from CRM UI; kept for DB compatibility. */
export type CrmPriority = "A" | "B" | "C";
export type CrmAccountType = "consultora" | "empresa" | "organismo" | "otro";
export type CrmPlanTarget = "starter" | "business" | "enterprise" | "profesional" | "free";
export type CrmSource =
  | "outbound_consultoras"
  | "import_2026_07"
  | "inbound"
  | "manual"
  | "referral"
  | "resoluciones_prospeccion"
  | "ai_sdr";
export type CrmActivityType =
  | "nota"
  | "email"
  | "linkedin"
  | "llamada"
  | "demo"
  | "seguimiento"
  | "post_demo";
export type CrmQualityFlag = "ok" | "needs_review" | "junk" | "pendiente_correo";

export interface CrmLead {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa: string;
  /** Tax ID used for resoluciones evidence matching (preferred over company name). */
  cif?: string | null;
  comercial_id: string | null;
  fase: LeadPhase;
  ultimo_contacto: string | null;
  proximo_contacto: string | null;
  /** Times contacted; drives next-contact spacing from followup_days. */
  contact_count?: number;
  comentarios: string | null;
  is_converted: boolean;
  web: string | null;
  linkedin_url: string | null;
  cargo: string | null;
  region: string | null;
  tipo_cuenta: CrmAccountType;
  prioridad: CrmPriority;
  gancho: string | null;
  plan_objetivo: CrmPlanTarget;
  fuente: CrmSource;
  email_copy: string | null;
  linkedin_copy: string | null;
  archived: boolean;
  quality_flag: CrmQualityFlag;
  comercial?: { full_name: string | null } | null;
}

export interface CrmActivity {
  id: string;
  lead_id: string;
  tipo: CrmActivityType;
  contenido: string;
  scheduled_for: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrmPlaybookEntry {
  key: string;
  title: string;
  body: string;
  updated_at: string;
}

export interface CrmIncident {
  id: string;
  cliente: string;
  descripcion: string;
  estado: IncidentStatus;
  prioridad: IncidentPriority;
  fecha: string;
}

export interface CrmPlanMonthlySnapshot {
  month_date: string;
  users_total: number;
  users_free: number;
  users_pro: number;
  users_business: number;
  captured_at: string;
}

export interface CrmMemoriaMonthlySnapshot {
  month_date: string;
  memorias_redactadas: number;
  memorias_revisadas: number;
  captured_at: string;
}

export interface CrmDashboardLiveMetrics {
  users_total: number;
  users_free: number;
  users_pro: number;
  users_business: number;
  memorias_redactadas: number;
  memorias_revisadas: number;
}

export interface CrmDashboardMetrics {
  live: CrmDashboardLiveMetrics;
  plan_history: CrmPlanMonthlySnapshot[];
  memoria_history: CrmMemoriaMonthlySnapshot[];
}

export interface AdminDocument {
  id: string;
  title: string;
  url: string;
  section: string;
  created_at: string;
}

export interface StaffProfile {
  user_id: string;
  full_name: string | null;
  role: string;
  job_title?: string | null;
  work_email?: string | null;
  /** Cal.com or Calendly URL, edited on Admin → Empleados. */
  calendly_url?: string | null;
}

export interface StripeFinancials {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  forecastRevenue: number;
  yearRevenue?: number;
  year?: number;
  monthlyBreakdown: { month: string; revenue: number }[];
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  recurrent: "Recurrente",
  payroll: "Nómina",
  one_time: "Puntual",
  interest: "Intereses",
  tax: "Impuestos",
  depreciation: "Depreciación",
  amortization: "Amortización",
};

export const EXPENSE_PROVIDER_LABELS: Record<ExpenseProvider, string> = {
  manual: "Manual",
  openai: "OpenAI",
  hetzner: "Hetzner",
  cloudflare: "Cloudflare",
};

export const LEAD_PHASE_LABELS: Record<LeadPhase, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Vacaciones",
  sick_leave: "Baja médica",
  maternity: "Baja maternidad",
  justified: "Ausencia justificada",
  pending: "Vacaciones (solicitud)",
};

export const ABSENCE_COLORS: Record<AbsenceType, string> = {
  vacation: "bg-emerald-500",
  sick_leave: "bg-red-500",
  maternity: "bg-purple-500",
  justified: "bg-blue-500",
  pending: "bg-amber-400",
};

export const EXPECTED_DAILY_HOURS = 8;
export const EXPECTED_WEEKLY_HOURS = 40;
