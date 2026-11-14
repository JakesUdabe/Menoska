import Link from "next/link";
import { logout, setWorkspace } from "@/app/app/actions";
import type { Profile } from "@/lib/workspace";
import { modules } from "@/lib/workspace";

export function AppFrame({
  profile,
  clients,
  mode,
  clientId,
  children,
}: {
  profile: Profile;
  clients: Profile[];
  mode: "admin" | "client";
  clientId: string;
  children: React.ReactNode;
}) {
  const admin = profile.role === "admin";
  const showAdmin = admin && mode === "admin";
  const activeClient = clients.find((item) => item.id === clientId);

  return (
    <div className="app-shell">
      <aside className="app-side">
        <Link href="/" className="brand">
          <img src="/mark.svg" alt="" width={42} height={30} />
          <span>
            Menoska
            <small>Consulting</small>
          </span>
        </Link>
        <p className="app-user">
          {profile.first_name} {profile.last_name}
          <small>{admin ? "Admin" : "Cliente"}</small>
        </p>
        <nav>
          {modules.map((item) => (
            <Link key={item.id} href={`/app/${item.slug}`}>
              {item.name}
            </Link>
          ))}
          {showAdmin ? <Link href="/app/admin">Admin</Link> : null}
        </nav>
        <form action={logout}>
          <button className="text-button" type="submit">
            Cerrar sesión
          </button>
        </form>
      </aside>
      <div className="app-main">
        {admin ? (
          <form className="app-top" action={setWorkspace}>
            <div className="mode-switch">
              <button className={mode === "admin" ? "is-on" : ""} name="mode" value="admin" type="submit">
                Modo admin
              </button>
              <button className={mode === "client" ? "is-on" : ""} name="mode" value="client" type="submit">
                Modo cliente
              </button>
            </div>
            <label>
              Cliente
              <select name="clientId" defaultValue={clientId}>
                <option value="">Selecciona un cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" name="mode" value={mode}>
              Aplicar cliente
            </button>
            {activeClient ? (
              <p>
                Trabajando con {activeClient.first_name} {activeClient.last_name}
              </p>
            ) : (
              <p>Elige el cliente antes de rellenar un módulo.</p>
            )}
          </form>
        ) : null}
        {children}
      </div>
    </div>
  );
}
