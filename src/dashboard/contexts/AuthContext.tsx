"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/dashboard/integrations/supabase/client";

export type AuthProfile = {
  id: string;
  role: string | null;
  employee_permissions: Record<string, boolean> | null;
};

type AuthUser = { id: string };

type AuthValue = {
  user: AuthUser | null;
  profile: AuthProfile | null;
  profileLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const nextUser = data.user ? { id: data.user.id } : null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("id, role, employee_permissions")
        .eq("id", nextUser.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(
        row
          ? {
              id: row.id as string,
              role: (row.role as string | null) ?? null,
              employee_permissions:
                row.employee_permissions && typeof row.employee_permissions === "object"
                  ? (row.employee_permissions as Record<string, boolean>)
                  : null,
            }
          : null,
      );
      setProfileLoading(false);
    }

    void load();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/acceso/");
  }

  return (
    <AuthContext.Provider value={{ user, profile, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
