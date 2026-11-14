"use client";

import Link from "next/link";
import { addEntry, deleteEntry } from "@/app/app/actions";
import type { ModuleEntry } from "@/lib/workspace";

export function ModuleBoard({
  slug,
  moduleId,
  name,
  kind,
  entries,
  canEdit,
  hasClient,
}: {
  slug: string;
  moduleId: string;
  name: string;
  kind: "kpi" | "report";
  entries: ModuleEntry[];
  canEdit: boolean;
  hasClient: boolean;
}) {
  const report = kind === "report";
  return (
    <section className="app-section">
      <div className="app-heading">
        <div>
          <p className="kicker">{name}</p>
          <h1>{report ? "Informe" : "Cuadro de mando"}</h1>
        </div>
        <div className="tab-row">
          <Link href={`/app/${slug}`} aria-current={report ? undefined : "page"}>
            Cuadro de mando
          </Link>
          <Link href={`/app/${slug}/informe`} aria-current={report ? "page" : undefined}>
            Informe
          </Link>
          {report ? (
            <button className="text-button" type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          ) : null}
        </div>
      </div>

      {!hasClient ? <p className="lead">Selecciona un cliente para ver este módulo.</p> : null}

      {report ? (
        <div className="report-doc">
          {entries.length === 0 && hasClient ? <p>Este informe todavía no tiene apartados.</p> : null}
          {entries.map((entry) => (
            <article key={entry.id}>
              <h2>{entry.title}</h2>
              <p>{entry.body}</p>
              {canEdit ? (
                <form action={deleteEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="text-button" type="submit">
                    Quitar apartado
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          {entries.length === 0 && hasClient ? <p>Todavía no hay indicadores.</p> : null}
          {entries.map((entry) => (
            <article key={entry.id}>
              <p className="stat-value">
                {entry.value}
                <span>{entry.unit}</span>
              </p>
              <h2>{entry.title}</h2>
              {entry.body ? <p>{entry.body}</p> : null}
              {canEdit ? (
                <form action={deleteEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="text-button" type="submit">
                    Quitar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {canEdit && hasClient ? (
        <form className="editor-form" action={addEntry}>
          <h2>{report ? "Añadir apartado" : "Añadir indicador"}</h2>
          <input type="hidden" name="module" value={moduleId} />
          <input type="hidden" name="kind" value={kind} />
          <label>
            Título
            <input name="title" required />
          </label>
          {report ? null : (
            <div className="form-row">
              <label>
                Valor
                <input name="value" required />
              </label>
              <label>
                Unidad
                <input name="unit" placeholder="€, %, meses" />
              </label>
            </div>
          )}
          <label>
            {report ? "Texto" : "Nota"}
            <textarea name="body" rows={report ? 6 : 3} required={report} />
          </label>
          <button className="btn" type="submit">
            Guardar
          </button>
        </form>
      ) : null}
    </section>
  );
}
