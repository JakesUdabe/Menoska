"use client";

import { useState } from "react";
import { deleteEmployee, saveEmployee, saveEmployeePhoto } from "@/app/app/actions";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";

export function EmployeeEditor({
  person,
  notice,
  returnTo,
}: {
  person: PublicEmployee;
  notice?: string;
  returnTo?: string;
}) {
  const [experience, setExperience] = useState<CvExperience[]>(person.experience);
  const [education, setEducation] = useState<CvEducation[]>(person.education);
  const [credentials, setCredentials] = useState<CvCredential[]>(person.credentials);
  const [visible, setVisible] = useState(person.visible);

  return (
    <section className="app-section">
      <p className="kicker">Equipo</p>
      <h1>{person.name}</h1>
      {notice === "ok" ? <p className="form-note">Guardado.</p> : null}
      {notice === "imagen" ? <p className="form-error">La imagen tiene que ser jpg, png, webp, gif o svg, y pesar menos de 5 MB.</p> : null}
      <form className="editor-form" action={saveEmployeePhoto}>
        <input type="hidden" name="id" value={person.id} />
        {returnTo ? <input type="hidden" name="next" value={returnTo} /> : null}
        <img className="editor-photo" src={person.image} alt="" />
        <label>
          Foto
          <input name="photo" type="file" accept="image/*" />
        </label>
        <button className="btn btn-light" type="submit">
          Actualizar foto
        </button>
      </form>
      <form
        className="editor-form"
        action={async (formData) => {
          await saveEmployee({
            id: person.id,
            name: String(formData.get("name") ?? ""),
            role: String(formData.get("role") ?? ""),
            bio: String(formData.get("bio") ?? ""),
            summary: String(formData.get("summary") ?? ""),
            linkedin: String(formData.get("linkedin") ?? ""),
            visible,
            experience,
            education,
            credentials,
            returnTo,
          });
        }}
      >
        <label>
          Nombre
          <input name="name" defaultValue={person.name} required />
        </label>
        <label>
          Cargo
          <input name="role" defaultValue={person.role} required />
        </label>
        <label>
          Texto breve en la ficha
          <textarea name="bio" rows={3} defaultValue={person.bio} />
        </label>
        <label>
          Perfil
          <textarea name="summary" rows={5} defaultValue={person.summary} />
        </label>
        <label>
          LinkedIn
          <input name="linkedin" defaultValue={person.linkedin} />
        </label>
        <label className="check-line">
          <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
          Visible en la web
        </label>

        <h2>Experiencia</h2>
        {experience.map((item, index) => (
          <div className="repeat-block" key={`exp-${index}`}>
            <input value={item.role} placeholder="Cargo" onChange={(event) => update(experience, setExperience, index, { role: event.target.value })} />
            <input value={item.org} placeholder="Organización" onChange={(event) => update(experience, setExperience, index, { org: event.target.value })} />
            <input value={item.when} placeholder="Fechas" onChange={(event) => update(experience, setExperience, index, { when: event.target.value })} />
            <textarea value={item.text} rows={3} onChange={(event) => update(experience, setExperience, index, { text: event.target.value })} />
            <button className="text-button" type="button" onClick={() => setExperience(experience.filter((_, itemIndex) => itemIndex !== index))}>
              Quitar
            </button>
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => setExperience([...experience, { role: "", org: "", when: "", text: "" }])}>
          Añadir experiencia
        </button>

        <h2>Formación</h2>
        {education.map((item, index) => (
          <div className="repeat-block" key={`edu-${index}`}>
            <input value={item.title} placeholder="Título" onChange={(event) => update(education, setEducation, index, { title: event.target.value })} />
            <input value={item.org} placeholder="Centro" onChange={(event) => update(education, setEducation, index, { org: event.target.value })} />
            <input value={item.when} placeholder="Fechas" onChange={(event) => update(education, setEducation, index, { when: event.target.value })} />
            <textarea value={item.text} rows={3} onChange={(event) => update(education, setEducation, index, { text: event.target.value })} />
            <button className="text-button" type="button" onClick={() => setEducation(education.filter((_, itemIndex) => itemIndex !== index))}>
              Quitar
            </button>
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => setEducation([...education, { title: "", org: "", when: "", text: "" }])}>
          Añadir formación
        </button>

        <h2>Credenciales</h2>
        {credentials.map((item, index) => (
          <div className="repeat-block" key={`cred-${index}`}>
            <input value={item.title} placeholder="Título" onChange={(event) => update(credentials, setCredentials, index, { title: event.target.value })} />
            <input value={item.org} placeholder="Entidad" onChange={(event) => update(credentials, setCredentials, index, { org: event.target.value })} />
            <input value={item.when} placeholder="Fecha" onChange={(event) => update(credentials, setCredentials, index, { when: event.target.value })} />
            <button className="text-button" type="button" onClick={() => setCredentials(credentials.filter((_, itemIndex) => itemIndex !== index))}>
              Quitar
            </button>
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => setCredentials([...credentials, { title: "", org: "", when: "" }])}>
          Añadir credencial
        </button>
        <button className="btn" type="submit">
          Guardar CV
        </button>
      </form>
      <form action={deleteEmployee}>
        <input type="hidden" name="id" value={person.id} />
        {returnTo ? <input type="hidden" name="next" value={withoutPerson(returnTo)} /> : null}
        <button className="text-button" type="submit">
          Eliminar del equipo
        </button>
      </form>
    </section>
  );
}

function withoutPerson(path: string) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("id");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  return `${url.pathname}${url.search}`;
}

function update<T>(list: T[], setList: (next: T[]) => void, index: number, patch: Partial<T>) {
  setList(list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}
