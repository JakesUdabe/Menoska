"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_LOGIN_ACCOUNTS, DEMO_PROFILES, type DemoProfile } from "@/lib/demo-data";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { normalizeEmployeePermissions, type EmployeePermissionKey } from "@/lib/admin/rbac";
import { asSessionRole, type AppRole, type PlanType, type SessionRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-store";
import { upsertOrg } from "@/lib/orgs-store";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: SessionRole;
  locale: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationDomain: string | null;
  plan: PlanType;
  employeePermissions: Record<EmployeePermissionKey, boolean>;
  jobTitle: string | null;
  workEmail: string | null;
  calendlyUrl: string | null;
};

export type AuthProfile = {
  id: string;
  role: SessionRole;
  full_name: string;
  employee_permissions: Record<EmployeePermissionKey, boolean>;
  job_title: string | null;
  work_email: string | null;
  calendly_url: string | null;
};

type DemoAccount = {
  email: string;
  password: string;
  profile: DemoProfile;
};

type AuthContextValue = {
  user: SessionUser | null;
  session: { user: { id: string; email: string } } | null;
  profile: AuthProfile | null;
  loading: boolean;
  profileLoading: boolean;
  demo: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error?: string; role?: SessionRole }>;
  signUp: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName?: string;
  }) => Promise<{ error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  setDemoUser: (profile: DemoProfile) => void;
  setDemoPlan: (plan: PlanType) => void;
  updateProfile: (patch: Partial<Pick<SessionUser, "firstName" | "lastName" | "locale" | "organizationName" | "plan">>) => Promise<{ error?: string }>;
  changePassword: (password: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string; demo?: boolean }>;
  updatePasswordFromRecovery: (password: string) => Promise<{ error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER_KEY = "menoska_demo_user";
const DEMO_USER_OLD_KEY = "abi_demo_user";
const DEMO_ACCOUNTS_KEY = "menoska_demo_accounts";

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function toSession(profile: DemoProfile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`.trim(),
    role: profile.role,
    locale: profile.locale,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    organizationDomain: profile.organizationDomain,
    plan: profile.plan,
    employeePermissions: { ...normalizeEmployeePermissions(null) },
    jobTitle: null,
    workEmail: null,
    calendlyUrl: null,
  };
}

function readDemoAccounts(): DemoAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDemoAccounts(accounts: DemoAccount[]) {
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function domainFromEmail(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "demo.local";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = !isSupabaseConfigured();

  const persist = useCallback((next: SessionUser | null) => {
    setUser(next);
    if (next) writeStorage(DEMO_USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(DEMO_USER_KEY);
  }, []);

  useEffect(() => {
    if (demo) {
      try {
        const raw = readMigratedStorage(DEMO_USER_KEY, DEMO_USER_OLD_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as SessionUser & { fullName?: string };
          if (!parsed.firstName && parsed.fullName) {
            const names = splitName(parsed.fullName);
            parsed.firstName = names.firstName;
            parsed.lastName = names.lastName;
          }
          parsed.role = asSessionRole(parsed.role);
          parsed.employeePermissions = normalizeEmployeePermissions(parsed.employeePermissions);
          parsed.jobTitle = parsed.jobTitle ?? null;
          parsed.workEmail = parsed.workEmail ?? null;
          parsed.calendlyUrl = parsed.calendlyUrl ?? null;
          setUser(parsed);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("mc_profiles")
        .select(
          "first_name, last_name, full_name, locale, role, organization_id, employee_permissions, job_title, work_email, calendly_url, mc_organizations!mc_profiles_organization_id_fkey(name, domain, plan)",
        )
        .eq("id", data.user.id)
        .maybeSingle();
      const orgRaw = (
        profile as {
          mc_organizations?:
            | { name: string; domain: string; plan: PlanType }
            | { name: string; domain: string; plan: PlanType }[]
            | null;
        } | null
      )?.mc_organizations;
      const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
      const names = splitName(profile?.full_name ?? data.user.email ?? "");
      setUser({
        id: data.user.id,
        email: data.user.email ?? "",
        firstName: profile?.first_name ?? names.firstName,
        lastName: profile?.last_name ?? names.lastName,
        fullName: profile?.full_name ?? `${names.firstName} ${names.lastName}`.trim(),
        role: asSessionRole(profile?.role),
        locale: profile?.locale ?? "es",
        organizationId: profile?.organization_id ?? null,
        organizationName: org?.name ?? null,
        organizationDomain: org?.domain ?? null,
        plan: org?.plan ?? "starter",
        employeePermissions: normalizeEmployeePermissions(profile?.employee_permissions),
        jobTitle: profile?.job_title ?? null,
        workEmail: profile?.work_email ?? null,
        calendlyUrl: profile?.calendly_url ?? null,
      });
      setLoading(false);
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [demo]);

  const setDemoUser = useCallback(
    (profile: DemoProfile) => {
      persist(toSession(profile));
    },
    [persist],
  );

  const setDemoPlan = useCallback(
    (plan: PlanType) => {
      if (!user) return;
      const prev = user.plan;
      const next = { ...user, plan };
      persist(next);
      const accounts = readDemoAccounts();
      const idx = accounts.findIndex((a) => a.profile.id === user.id || a.email === user.email.toLowerCase());
      if (idx >= 0) {
        accounts[idx] = {
          ...accounts[idx],
          profile: { ...accounts[idx].profile, plan },
        };
        writeDemoAccounts(accounts);
      }
      void logAudit({
        actorId: user.id,
        orgId: user.organizationId,
        action: "plan_change",
        meta: { from: prev, to: plan, plan },
      });
    },
    [persist, user],
  );

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const { track } = await import("@/lib/analytics");
      if (demo) {
        const raw = identifier.trim();
        const lower = raw.toLowerCase();
        const account = DEMO_LOGIN_ACCOUNTS.find(
          (entry) => entry.username === raw && entry.password === password,
        );
        const profile = account ? DEMO_PROFILES.find((p) => p.id === account.profileId) : undefined;
        if (profile) {
          setDemoUser(profile);
          void track("login", { userId: profile.id, demo: true, role: profile.role });
          return { role: profile.role };
        }
        const registered = readDemoAccounts().find(
          (a) => a.email === lower && a.password === password,
        );
        if (registered) {
          setDemoUser(registered.profile);
          void track("login", { userId: registered.profile.id, demo: true, role: registered.profile.role });
          return { role: registered.profile.role };
        }
        return { error: "auth.invalidCredentials" };
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (!error) void track("login", { demo: false });
      return error ? { error: error.message } : {};
    },
    [demo, setDemoUser],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      organizationName?: string;
    }) => {
      if (demo) {
        const email = input.email.trim().toLowerCase();
        if (!email.includes("@") || input.password.length < 8) {
          return { error: "auth.invalidCredentials" };
        }
        const accounts = readDemoAccounts();
        if (accounts.some((a) => a.email === email)) {
          return { error: "auth.invalidCredentials" };
        }
        const domain = domainFromEmail(email);
        const orgName = (input.organizationName?.trim() || domain.split(".")[0] || "Demo Org").replace(/\b\w/g, (c) =>
          c.toUpperCase(),
        );
        const orgId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `org-${Date.now()}`;
        const userId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`;
        const profile: DemoProfile = {
          id: userId,
          email,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
          role: "client",
          locale: "es",
          organizationId: orgId,
          organizationName: orgName,
          organizationDomain: domain,
          plan: "starter",
        };
        upsertOrg({
          id: orgId,
          name: orgName,
          domain,
          plan: "starter",
          mrr: 0,
          status: "trialing",
        });
        accounts.push({ email, password: input.password, profile });
        writeDemoAccounts(accounts);
        setDemoUser(profile);
        const { track } = await import("@/lib/analytics");
        void track("signup", { userId: profile.id, organizationId: orgId, demo: true });
        return {};
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            product: "menoska",
            first_name: input.firstName,
            last_name: input.lastName,
            full_name: `${input.firstName} ${input.lastName}`.trim(),
            organization_name: input.organizationName ?? "",
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { error: error.message };
      const { track } = await import("@/lib/analytics");
      void track("signup", { demo: false });
      return { needsVerification: true };
    },
    [demo, setDemoUser],
  );

  const signOut = useCallback(async () => {
    if (demo) {
      persist(null);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, [demo, persist]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<SessionUser, "firstName" | "lastName" | "locale" | "organizationName" | "plan">>) => {
      if (!user) return { error: "no_session" };
      const next: SessionUser = {
        ...user,
        ...patch,
        fullName: `${patch.firstName ?? user.firstName} ${patch.lastName ?? user.lastName}`.trim(),
      };
      if (demo) {
        persist(next);
        const accounts = readDemoAccounts();
        const idx = accounts.findIndex((a) => a.profile.id === user.id || a.email === user.email.toLowerCase());
        if (idx >= 0) {
          accounts[idx] = {
            ...accounts[idx],
            profile: {
              ...accounts[idx].profile,
              firstName: next.firstName,
              lastName: next.lastName,
              fullName: next.fullName,
              locale: next.locale,
              organizationName: next.organizationName ?? accounts[idx].profile.organizationName,
              plan: next.plan,
            },
          };
          writeDemoAccounts(accounts);
        }
        return {};
      }
      const supabase = createClient();
      const { error } = await supabase
        .from("mc_profiles")
        .update({
          first_name: next.firstName,
          last_name: next.lastName,
          full_name: next.fullName,
          locale: next.locale,
        })
        .eq("id", user.id);
      if (error) return { error: error.message };
      setUser(next);
      return {};
    },
    [demo, persist, user],
  );

  const changePassword = useCallback(
    async (password: string) => {
      if (password.length < 8) return { error: "min_8" };
      if (demo) {
        if (!user) return { error: "no_session" };
        const accounts = readDemoAccounts();
        const idx = accounts.findIndex((a) => a.profile.id === user.id || a.email === user.email.toLowerCase());
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], password };
          writeDemoAccounts(accounts);
        }
        return {};
      }
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { error: error.message } : {};
    },
    [demo, user],
  );

  const deleteAccount = useCallback(async () => {
    if (!user) return { error: "no_session" };
    if (demo) {
      const accounts = readDemoAccounts().filter(
        (a) => a.profile.id !== user.id && a.email !== user.email.toLowerCase(),
      );
      writeDemoAccounts(accounts);
      persist(null);
      return {};
    }
    const supabase = createClient();
    await supabase.from("mc_deletion_requests").insert({ user_id: user.id, reason: "self-service" });
    await supabase.auth.signOut();
    setUser(null);
    return {};
  }, [demo, persist, user]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes("@")) return { error: "auth.invalidCredentials" };
      if (demo) return { demo: true };
      const supabase = createClient();
      const locale = typeof window !== "undefined" ? window.location.pathname.split("/")[1] || "es" : "es";
      const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/nueva-contrasena`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      return error ? { error: error.message } : {};
    },
    [demo],
  );

  const updatePasswordFromRecovery = useCallback(
    async (password: string) => {
      if (password.length < 8) return { error: "min_8" };
      if (demo) return { error: "demo_no_recovery" };
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { error: error.message } : {};
    },
    [demo],
  );

  const resendVerificationEmail = useCallback(
    async (email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes("@")) return { error: "auth.invalidCredentials" };
      if (demo) return { error: "demo_no_email" };
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return error ? { error: error.message } : {};
    },
    [demo],
  );

  const profile: AuthProfile | null = user
    ? {
        id: user.id,
        role: user.role,
        full_name: user.fullName,
        employee_permissions: user.employeePermissions,
        job_title: user.jobTitle,
        work_email: user.workEmail,
        calendly_url: user.calendlyUrl,
      }
    : null;
  const session = user ? { user: { id: user.id, email: user.email } } : null;

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading: loading,
      demo,
      signIn,
      signUp,
      signOut,
      setDemoUser,
      setDemoPlan,
      updateProfile,
      changePassword,
      deleteAccount,
      requestPasswordReset,
      updatePasswordFromRecovery,
      resendVerificationEmail,
    }),
    [
      user,
      session,
      profile,
      loading,
      demo,
      signIn,
      signUp,
      signOut,
      setDemoUser,
      setDemoPlan,
      updateProfile,
      changePassword,
      deleteAccount,
      requestPasswordReset,
      updatePasswordFromRecovery,
      resendVerificationEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
