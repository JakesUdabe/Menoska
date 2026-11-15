import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://menoska-consulting.com",
  "https://www.menoska-consulting.com",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "correo" });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Menoska Consulting <noreply@menoska-consulting.com>";
  if (!url || !anon || !service || !resendKey) return json({ ok: false, code: "correo" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, code: "correo" }, 401);

  const { data: profile } = await userClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return json({ ok: false, code: "correo" }, 403);

  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const nif = String(body.nif ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "client";
  const origin = ALLOWED_ORIGINS.has(String(body.origin ?? ""))
    ? String(body.origin)
    : "https://menoska-consulting.com";
  if (!firstName || !lastName || !nif || !email.includes("@")) return json({ ok: false, code: "datos" }, 400);

  const admin = createClient(url, service);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { first_name: firstName, last_name: lastName, nif },
      redirectTo: `${origin}/auth/confirm/`,
    },
  });
  const userId = linkData?.user?.id;
  const token = linkData?.properties?.hashed_token;
  if (linkError || !userId || !token) {
    const message = (linkError?.message ?? "").toLowerCase();
    const code = message.includes("nif")
      ? "nif"
      : message.includes("already") || message.includes("registered") || message.includes("exists")
        ? "existe"
        : "correo";
    return json({ ok: false, code });
  }

  if (role === "admin") {
    await admin.auth.admin.updateUserById(userId, { app_metadata: { role: "admin" } });
  }
  const { error: profileError } = await admin
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, nif, email, role })
    .eq("id", userId);
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    const code = profileError.message.toLowerCase().includes("nif") ? "nif" : "correo";
    return json({ ok: false, code });
  }

  const confirm = `${origin}/auth/confirm/?token_hash=${encodeURIComponent(token)}&type=invite`;
  const name = escapeHtml(firstName);
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Crea tu cuenta en Menoska",
      html: `<p>Hola ${name},</p><p>Tienes un acceso a Menoska. Abre este enlace para crear tu contraseña:</p><p><a href="${confirm}">Crear cuenta</a></p><p>Si no esperabas este correo, puedes ignorarlo.</p>`,
    }),
  });
  if (!sent.ok) {
    await admin.auth.admin.deleteUser(userId);
    return json({ ok: false, code: "correo" });
  }

  return json({ ok: true });
});
