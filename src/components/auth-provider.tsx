"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_PROFILES, type DemoProfile } from "@/lib/demo-data";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import type { AppRole, PlanType } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: AppRole;
  locale: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationDomain: string | null;
  plan: PlanType;
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  demo: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName?: string;
  }) => Promise<{ error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  setDemoUser: (profile: DemoProfile) => void;
  updateProfile: (patch: Partial<Pick<SessionUser, "firstName" | "lastName" | "locale" | "organizationName">>) => Promise<{ error?: string }>;
  changePassword: (password: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_KEY = "abi_demo_user";

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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = !isSupabaseConfigured();

  const persist = useCallback((next: SessionUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    else localStorage.removeItem(DEMO_KEY);
  }, []);

  useEffect(() => {
    if (demo) {
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as SessionUser & { fullName?: string };
          if (!parsed.firstName && parsed.fullName) {
            const names = splitName(parsed.fullName);
            parsed.firstName = names.firstName;
            parsed.lastName = names.lastName;
          }
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
        .from("profiles")
        .select("first_name, last_name, full_name, locale, role, organization_id, organizations(name, domain, plan)")
        .eq("id", data.user.id)
        .maybeSingle();
      const org = (profile as { organizations?: { name: string; domain: string; plan: PlanType } | null } | null)
        ?.organizations;
      const names = splitName(profile?.full_name ?? data.user.email ?? "");
      setUser({
        id: data.user.id,
        email: data.user.email ?? "",
        firstName: profile?.first_name ?? names.firstName,
        lastName: profile?.last_name ?? names.lastName,
        fullName: profile?.full_name ?? `${names.firstName} ${names.lastName}`.trim(),
        role: (profile?.role as AppRole) ?? "client",
        locale: profile?.locale ?? "es",
        organizationId: profile?.organization_id ?? null,
        organizationName: org?.name ?? null,
        organizationDomain: org?.domain ?? null,
        plan: org?.plan ?? "starter",
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (demo) {
        const found = DEMO_PROFILES.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
        if (!found || password.length < 6) return { error: "Credenciales no válidas (demo: usa un email de demostración)." };
        setDemoUser(found);
        return {};
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        return { needsVerification: true };
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
            full_name: `${input.firstName} ${input.lastName}`.trim(),
            organization_name: input.organizationName ?? "",
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { error: error.message };
      return { needsVerification: true };
    },
    [demo],
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
    async (patch: Partial<Pick<SessionUser, "firstName" | "lastName" | "locale" | "organizationName">>) => {
      if (!user) return { error: "no_session" };
      const next: SessionUser = {
        ...user,
        ...patch,
        fullName: `${patch.firstName ?? user.firstName} ${patch.lastName ?? user.lastName}`.trim(),
      };
      if (demo) {
        persist(next);
        return {};
      }
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
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
      if (demo) return {};
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { error: error.message } : {};
    },
    [demo],
  );

  const deleteAccount = useCallback(async () => {
    if (!user) return { error: "no_session" };
    if (demo) {
      persist(null);
      return {};
    }
    const supabase = createClient();
    await supabase.from("deletion_requests").insert({ user_id: user.id, reason: "self-service" });
    await supabase.auth.signOut();
    setUser(null);
    return {};
  }, [demo, persist, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      demo,
      signIn,
      signUp,
      signOut,
      setDemoUser,
      updateProfile,
      changePassword,
      deleteAccount,
    }),
    [user, loading, demo, signIn, signUp, signOut, setDemoUser, updateProfile, changePassword, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
