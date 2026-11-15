"use client";

import { login, setPassword } from "@/app/acceso/actions";

export function LoginForm({ error }: { error?: string }) {
  return (
    <form className="access-card" action={login}>
      <p className="kicker">Acceso</p>
      <h1>Iniciar sesión</h1>
      <p className="lead">El acceso lo crea el equipo de Menoska. No hay registro público.</p>
      {error === "credenciales" ? <p className="form-error">El correo o la contraseña no son válidos.</p> : null}
      {error === "enlace" ? <p className="form-error">El enlace ha caducado o ya se ha usado.</p> : null}
      <label>
        Correo
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="btn" type="submit">
        Entrar
      </button>
    </form>
  );
}

export function PasswordForm({ error }: { error?: string }) {
  return (
    <form className="access-card" action={setPassword}>
      <p className="kicker">Acceso</p>
      <h1>Crea tu contraseña</h1>
      <p className="lead">Mínimo 8 caracteres. Después entrarás en tu área de trabajo.</p>
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
