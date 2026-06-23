import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { db } from "../db/database";
import { createDemoUnit, createUnit, deleteUnit, duplicateUnit, ensureDefaultProject } from "../features/units/unitService";
import { exportProjectPackage, exportUnitPackage, importProjectPackage, importUnitPackage } from "../features/backup/backupService";
import type { Project } from "../schemas/domain";

export function HomePage() {
  const [project, setProject] = useState<Project>();
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const units = useLiveQuery(() => project ? db.units.where("projectId").equals(project.id).sortBy("updatedAt") : [], [project?.id]);
  const counts = useLiveQuery(async () => {
    if (!units) return {};
    const rows: Record<string, { sessions: number; activities: number }> = {};
    for (const unit of units) {
      const sessions = await db.sessions.where("unitId").equals(unit.id).toArray();
      const activities = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).count()))).reduce((a, b) => a + b, 0);
      rows[unit.id] = { sessions: sessions.length, activities };
    }
    return rows;
  }, [units?.map((unit) => unit.updatedAt).join("|")]);

  useEffect(() => { ensureDefaultProject().then(setProject).catch((reason: unknown) => setError(String(reason))); }, []);

  const handleCreate = async () => {
    if (!project) return;
    const unit = await createUnit(project.id);
    navigate(`/unit/${unit.id}`);
  };

  const handleImport = async (file?: File) => {
    if (!file || !project) return;
    try {
      if (file.name.endsWith(".udproject")) {
        await importProjectPackage(file);
        setProject(await ensureDefaultProject());
      } else {
        const id = await importUnitPackage(file, project.id);
        navigate(`/unit/${id}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el paquete.");
    }
  };

  return (
    <main className="home-shell">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Programación · Lengua Castellana y Literatura · 4.º ESO</p>
          <h1>Cuaderno de unidades</h1>
          <p className="lead">Un editor local-first para construir, revisar y llevar a papel unidades didácticas con la estructura de los modelos de Nerea Bouzas.</p>
        </div>
        <div className="hero-actions">
          <button className="button button--primary" onClick={handleCreate}>Crear unidad</button>
          <button className="button" onClick={async () => project && navigate(`/unit/${(await createDemoUnit(project.id)).id}`)}>Crear unidad demo</button>
          <button className="button" onClick={() => importRef.current?.click()}>Restaurar copia</button>
          <button className="button" onClick={() => project && exportProjectPackage(project.id)}>Copia del proyecto</button>
          <input ref={importRef} hidden type="file" accept=".udpack,.udproject,.zip" onChange={(event) => handleImport(event.target.files?.[0])} />
        </div>
      </header>

      <aside className="local-notice">
        <strong>Los datos viven en este navegador.</strong> Persisten en el mismo dispositivo, pero no se sincronizan. Descarga copias con regularidad.
        {project?.lastBackupAt && <span> Última copia: {new Date(project.lastBackupAt).toLocaleString("es-ES")}.</span>}
      </aside>
      <aside className="format-guide">
        <div><strong>PDF</strong><span>Es el documento que Nerea puede abrir, leer e imprimir. Se crea desde «Ver PDF».</span></div>
        <div><strong>.udpack</strong><span>Es una copia editable para guardar o trasladar una unidad. Se abre importándola de nuevo en esta aplicación.</span></div>
      </aside>
      {error && <p className="error-banner">{error}</p>}

      <section aria-labelledby="units-title">
        <div className="section-heading">
          <h2 id="units-title">Unidades</h2>
          <span>{units?.length ?? 0} creadas</span>
        </div>
        {!units?.length ? (
          <button className="empty-state" onClick={handleCreate}>
            <span className="empty-state__number">01</span>
            <strong>Empieza la primera unidad</strong>
            <span>Se crearán doce apartados y una primera sesión. Después podrás añadir las que necesites.</span>
          </button>
        ) : (
          <div className="unit-grid">
            {[...units].reverse().map((unit) => (
              <article className="unit-card" key={unit.id} style={{ "--unit-color": unit.color } as React.CSSProperties}>
                <div className="unit-card__number">UD {String(unit.number).padStart(2, "0")}</div>
                <div className="unit-card__body">
                  <span className={`status status--${unit.status}`}>{unit.status === "draft" ? "Borrador" : unit.status === "review" ? "En revisión" : "Completa"}</span>
                  <h3>{unit.title}</h3>
                  <p>{unit.thematicAxis || "Eje temático pendiente"}</p>
                  <dl>
                    <div><dt>Sesiones</dt><dd>{counts?.[unit.id]?.sessions ?? "—"}</dd></div>
                    <div><dt>Actividades</dt><dd>{counts?.[unit.id]?.activities ?? "—"}</dd></div>
                    <div><dt>Modificada</dt><dd>{new Date(unit.updatedAt).toLocaleDateString("es-ES")}</dd></div>
                  </dl>
                </div>
                <div className="unit-card__actions">
                  <button className="button button--primary" onClick={() => navigate(`/unit/${unit.id}`)}>Abrir</button>
                  <button className="button" onClick={() => navigate(`/unit/${unit.id}?tab=export`)}>Ver PDF</button>
                  <button className="button" onClick={() => duplicateUnit(unit)}>Duplicar</button>
                  <button className="button" onClick={() => exportUnitPackage(unit)}>Copia editable</button>
                  <button className="button button--danger" onClick={() => confirm(`¿Eliminar “${unit.title}”?`) && deleteUnit(unit.id)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
