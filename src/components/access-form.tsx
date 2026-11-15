"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordReset, setPassword, signIn, type AccessNotice } from "@/app/acceso/actions";
import { useLocale } from "./locale";

export function LoginForm({ error, variant = "page" }: { error?: string; variant?: "page" | "panel" }) {
  const { copy } = useLocale();
  const text = copy.access;
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<AccessNotice | null>(error === "enlace" ? "expired" : error === "credenciales" ? "invalid" : null);

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setNotice(null);
    const result = await signIn(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    if (result) {
      setNotice(result);
      setPending(false);
    }
  }

  async function onReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const result = await sendPasswordReset(email);
    setNotice(result);
    setPending(false);
  }

  const Title = variant === "panel" ? "h2" : "h1";
  const message = notice === "sent" ? text.sent : notice ? text[notice] : "";

  return (
    <div className={variant === "panel" ? "login-panel-body" : "access-card"}>
      <p className="kicker">{text.kicker}</p>
      <Title>{mode === "forgot" ? text.forgotTitle : text.title}</Title>
      {mode === "forgot" ? <p className="access-note">{text.forgotLead}</p> : null}
      {message ? <p className={notice === "sent" ? "form-note" : "form-error"}>{message}</p> : null}
      {mode === "login" ? (
        <form onSubmit={onLogin}>
          <label>
            {text.email}
            <input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            {text.password}
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit" disabled={pending}>
            {text.submit}
          </button>
          <button className="link-button" type="button" onClick={() => { setMode("forgot"); setNotice(null); }}>
            {text.forgot}
          </button>
        </form>
      ) : (
        <form onSubmit={onReset}>
          <label>
            {text.email}
            <input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="btn" type="submit" disabled={pending}>
            {text.send}
          </button>
          <button className="link-button" type="button" onClick={() => { setMode("login"); setNotice(null); }}>
            {text.back}
          </button>
        </form>
      )}
    </div>
  );
}

export function PasswordForm({ error }: { error?: string }) {
  return (
    <form className="access-card" action={setPassword}>
      <p className="kicker">Acceso</p>
      <h1>Crea tu contraseña</h1>
      <p className="access-note">Mínimo 8 caracteres. Después entrarás en tu área de trabajo.</p>
      {error ? <p className="form-error">Las dos contraseñas tienen que coincidir y tener al menos 8 caracteres.</p> : null}
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        Repite la contraseña
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="btn" type="submit">
        Guardar y entrar
      </button>
    </form>
  );
}
