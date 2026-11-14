import Link from "next/link";
import { addTrajectory, createEmployee, deleteTrajectory, inviteUser, saveCover, saveStats, updateTrajectory } from "@/app/app/actions";
import type { PublicEmployee } from "@/lib/content";
import { es } from "@/i18n/es";
import type { Profile } from "@/lib/workspace";

const sections = [
  { id: "portada", label: "Portada" },
  { id: "trayectoria", label: "Trayectoria" },
  { id: "numeros", label: "Números" },
  { id: "equipo", label: "Equipo" },
  { id: "usuarios", label: "Usuarios" },
] as const;

type Section = (typeof sections)[number]["id"];

type Settings = {
  hero_image_url: string;
  about_image_url: string;
  stat_1_value: number;
  stat_1_prefix: string;
  stat_1_suffix: string;
  stat_2_value: number;
  stat_2_prefix: string;
  stat_2_suffix: string;
  stat_3_value: number;
  stat_3_prefix: string;
  stat_3_suffix: string;
  stat_4_value: number;
  stat_4_prefix: string;
  stat_4_suffix: string;
};

type Trajectory = { id: string; name: string; href: string; logo_url: string | null; sort_order: number };

export function AdminPanel({
  section,
  notice,
  settings,
  trajectory,
  employees,
  users,
}: {
  section: Section;
  notice?: string;
  settings: Settings;
  trajectory: Trajectory[];
  employees: PublicEmployee[];
  users: Profile[];
}) {
  return (
    <section className="app-section">
      <p className="kicker">Admin</p>
      <h1>Contenido y accesos</h1>
      <div className="tab-row">
        {sections.map((item) => (
          <Link key={item.id} href={`/app/admin?seccion=${item.id}`} aria-current={section === item.id ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </div>
      {notice === "ok" ? <p className="form-note">Guardado.</p> : null}
      {notice === "datos" ? <p className="form-error">Revisa los campos. El enlace tiene que empezar por http.</p> : null}
      {notice === "correo" ? <p className="form-error">No se ha podido enviar el correo. Revisa Resend y vuelve a intentarlo.</p> : null}

      {section === "portada" ? (
        <form className="editor-form" action={saveCover}>
          <p>Estas imágenes salen en la portada: la foto principal y la de la banda de equipo.</p>
          <img className="editor-photo" src={settings.hero_image_url} alt="" />
          <label>
            Imagen principal
            <input name="hero" type="file" accept="image/*" />
          </label>
          <img className="editor-photo" src={settings.about_image_url} alt="" />
          <label>
            Imagen de la banda de equipo
            <input name="about" type="file" accept="image/*" />
          </label>
          <button className="btn" type="submit">
            Guardar portada
          </button>
        </form>
      ) : null}

      {section === "numeros" ? (
        <form className="editor-form" action={saveStats}>
          <p>Cifras de «Las finanzas de tu empresa, trabajadas a medida».</p>
          {[
            [1, settings.stat_1_prefix, settings.stat_1_value, settings.stat_1_suffix],
            [2, settings.stat_2_prefix, settings.stat_2_value, settings.stat_2_suffix],
            [3, settings.stat_3_prefix, settings.stat_3_value, settings.stat_3_suffix],
            [4, settings.stat_4_prefix, settings.stat_4_value, settings.stat_4_suffix],
          ].map(([index, prefix, value, suffix]) => (
            <fieldset key={index}>
              <legend>{es.tailored.stats[Number(index) - 1].label}</legend>
              <div className="form-row">
                <label>
                  Prefijo
                  <input name={`prefix_${index}`} defaultValue={prefix} />
                </label>
                <label>
                  Número
                  <input name={`value_${index}`} type="number" defaultValue={value} />
                </label>
                <label>
                  Sufijo
                  <input name={`suffix_${index}`} defaultValue={suffix} />
                </label>
              </div>
            </fieldset>
          ))}
          <button className="btn" type="submit">
            Guardar números
          </button>
        </form>
      ) : null}

      {section === "trayectoria" ? (
        <div className="stack">
          {trajectory.map((item) => (
            <form key={item.id} className="editor-form" action={updateTrajectory}>
              <input type="hidden" name="id" value={item.id} />
              {item.logo_url ? <img className="logo-preview" src={item.logo_url} alt="" /> : null}
              <div className="form-row">
                <label>
                  Nombre
                  <input name="name" defaultValue={item.name} required />
                </label>
                <label>
                  Enlace
                  <input name="href" defaultValue={item.href} required />
                </label>
                <label>
                  Orden
                  <input name="sort" type="number" defaultValue={item.sort_order} />
                </label>
              </div>
              <label>
                Logo
                <input name="logo" type="file" accept="image/*" />
              </label>
              <div className="form-row">
                <button className="btn" type="submit">
                  Guardar
                </button>
                <button className="text-button" type="submit" formAction={deleteTrajectory}>
                  Quitar
                </button>
              </div>
            </form>
          ))}
          <form className="editor-form" action={addTrajectory}>
            <h2>Añadir organización</h2>
            <div className="form-row">
              <label>
                Nombre
                <input name="name" required />
              </label>
              <label>
                Enlace
                <input name="href" placeholder="https://" required />
              </label>
            </div>
            <label>
              Logo
              <input name="logo" type="file" accept="image/*" />
            </label>
            <button className="btn" type="submit">
              Añadir
            </button>
          </form>
        </div>
      ) : null}

      {section === "equipo" ? (
        <div className="stack">
          {employees.map((person) => (
            <article className="person-row" key={person.id}>
              <img src={person.image} alt="" />
              <div>
                <h2>{person.name}</h2>
                <p>{person.role}</p>
              </div>
              <Link className="btn btn-light" href={`/app/admin/equipo/${person.id}`}>
                Editar CV
              </Link>
            </article>
          ))}
          <form className="editor-form" action={createEmployee}>
            <h2>Nueva persona</h2>
            <label>
              Nombre y apellidos
              <input name="name" required />
            </label>
            <button className="btn" type="submit">
              Crear ficha
            </button>
          </form>
        </div>
      ) : null}

      {section === "usuarios" ? (
        <div className="stack">
          <form className="editor-form" action={inviteUser}>
            <h2>Crear acceso</h2>
            <p>Se envía un correo para que la persona cree su contraseña. No hay alta pública.</p>
            <div className="form-row">
              <label>
                Nombre
                <input name="firstName" required />
              </label>
              <label>
                Apellidos
                <input name="lastName" required />
              </label>
            </div>
            <div className="form-row">
              <label>
                NIF
                <input name="nif" required />
              </label>
              <label>
                Correo
                <input name="email" type="email" required />
              </label>
              <label>
                Tipo
                <select name="role" defaultValue="client">
                  <option value="client">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <button className="btn" type="submit">
              Enviar invitación
            </button>
          </form>
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <strong>
                  {user.first_name} {user.last_name}
                </strong>
                <span>{user.email}</span>
                <span>{user.nif}</span>
                <span>{user.role === "admin" ? "Admin" : "Cliente"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
