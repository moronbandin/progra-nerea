import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { db } from "../db/database";
import type { Activity, CurriculumItem, CurriculumRelationship, Session, Unit, UnitSection } from "../schemas/domain";
import { sectionTitles } from "../schemas/domain";
import {
  addActivity, addSession, duplicateSession, removeActivity, removeSession, reorderActivities, reorderSessions,
  refreshGeneratedSections, updateActivity, updateSection, updateSession, updateUnit
} from "../features/units/unitService";
import { RichTextEditor } from "../components/RichTextEditor";
import { exportUnitPackage } from "../features/backup/backupService";
import { saveAsset } from "../features/assets/assetService";
import QRCode from "qrcode";
import { useUiStore } from "../store/uiStore";
import stageObjectives from "../data/curriculum/stage-objectives.json";
import criteria from "../data/curriculum/assessment-criteria.json";
import contents from "../data/curriculum/contents.json";
import blocks from "../data/curriculum/content-blocks.json";
import competences from "../data/curriculum/specific-competences.json";
import descriptors from "../data/curriculum/descriptors.json";
import relationships from "../data/curriculum/relationships.json";
import keyCompetences from "../data/curriculum/key-competences.json";

type Tab = "general" | "curriculum" | "sections" | "sessions" | "assessment" | "diversity" | "resources" | "design" | "review" | "export";
const tabs: [Tab, string][] = [
  ["general", "Datos generales"], ["curriculum", "Currículo"], ["sections", "Apartados"], ["sessions", "Sesiones"],
  ["assessment", "Evaluación"], ["diversity", "Atención a la diversidad"], ["resources", "Recursos"],
  ["design", "Diseño"], ["review", "Revisión"], ["export", "Vista previa / PDF"]
];

const diversityMeasures = [
  "Instrucciones fragmentadas", "Apoyo visual", "Modelos", "Organizadores", "Tiempo adicional",
  "Opción oral", "Opción escrita", "Opción multimodal", "Lectura segmentada", "Glosario",
  "Refuerzo", "Ampliación", "Enriquecimiento", "Agrupamiento de apoyo"
];

const activityTypes = ["lectura", "comprensión", "análisis lingüístico", "análisis literario", "debate", "producción escrita", "producción oral", "investigación", "comparación de fuentes", "cooperativa", "digital", "evaluación", "autoevaluación", "coevaluación", "refuerzo", "ampliación", "actividad libre"];
const phases = ["activación", "exploración", "desarrollo", "práctica guiada", "aplicación", "producción", "evaluación", "cierre", "refuerzo", "ampliación"];

export function UnitEditorPage() {
  const { unitId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(tabs.some(([key]) => key === requestedTab) ? requestedTab as Tab : "general");
  const saveState = useUiStore((state) => state.saveState);
  const unit = useLiveQuery(() => db.units.get(unitId), [unitId]);
  const sections = useLiveQuery(() => db.unitSections.where("unitId").equals(unitId).toArray(), [unitId]);
  const sessions = useLiveQuery(() => db.sessions.where("unitId").equals(unitId).sortBy("order"), [unitId]);
  const activities = useLiveQuery(async () => {
    const currentSessions = await db.sessions.where("unitId").equals(unitId).toArray();
    return (await Promise.all(currentSessions.map((session) => db.activities.where("sessionId").equals(session.id).sortBy("order")))).flat();
  }, [unitId, sessions?.map((session) => session.updatedAt).join("|")]);

  if (!unit || !sections || !sessions || !activities) return <main className="loading">Abriendo el cuaderno…</main>;

  const page = {
    general: <GeneralPanel unit={unit} />,
    curriculum: <CurriculumPanel unit={unit} />,
    sections: <SectionsPanel unit={unit} sections={sections} />,
    sessions: <SessionsPanel unit={unit} sessions={sessions} activities={activities} />,
    assessment: <AssessmentPanel unit={unit} sessions={sessions} activities={activities} />,
    diversity: <DiversityPanel unit={unit} />,
    resources: <ResourcesPanel unit={unit} />,
    design: <DesignPanel unit={unit} />,
    review: <ReviewPanel unit={unit} sections={sections} sessions={sessions} activities={activities} />,
    export: <ExportPanel unit={unit} sections={sections} sessions={sessions} activities={activities} />
  }[tab];

  return (
    <div className="editor-shell" style={{ "--unit-color": unit.color } as React.CSSProperties}>
      <aside className="editor-sidebar">
        <Link className="back-link" to="/">← Unidades</Link>
        <div className="editor-identity">
          <span>UD {String(unit.number).padStart(2, "0")}</span>
          <strong>{unit.title}</strong>
          <small className={`save-state save-state--${saveState}`}>{saveState === "saving" ? "Guardando…" : saveState === "pending" ? "Cambios pendientes" : saveState === "error" ? "Error al guardar" : "Guardado · IndexedDB"}</small>
        </div>
        <nav aria-label="Editor de la unidad">
          {tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </nav>
        <button className="button sidebar-backup" onClick={() => exportUnitPackage(unit)}>Guardar copia editable</button>
      </aside>
      <main className="editor-main">{page}</main>
    </div>
  );
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="panel-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></header>;
}

function Field({ label, value, onChange, type = "text", min }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: number }) {
  return <label className="field"><span>{label}</span><input type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function GeneralPanel({ unit }: { unit: Unit }) {
  const actualSessions = useLiveQuery(() => db.sessions.where("unitId").equals(unit.id).count(), [unit.id]);
  const patch = (changes: Partial<Unit>) => updateUnit(unit.id, changes);
  return <section>
    <PanelHeader eyebrow="Ficha editorial" title="Datos generales" text="Estos datos alimentan la portada, la temporalización y los textos generados." />
    <div className="form-grid">
      <Field label="Número" type="number" min={1} value={unit.number} onChange={(value) => patch({ number: Number(value) })} />
      <Field label="Título" value={unit.title} onChange={(title) => patch({ title })} />
      <Field label="Subtítulo" value={unit.subtitle} onChange={(subtitle) => patch({ subtitle })} />
      <Field label="Evaluación" value={unit.evaluation} onChange={(evaluation) => patch({ evaluation })} />
      <Field label="Fecha de inicio" type="date" value={unit.startDate} onChange={(startDate) => patch({ startDate })} />
      <Field label="Fecha de fin" type="date" value={unit.endDate} onChange={(endDate) => patch({ endDate })} />
      <label className="field"><span>Sesiones actuales</span><input value={actualSessions ?? 0} readOnly aria-readonly="true" /></label>
      <Field label="Duración por sesión" type="number" min={1} value={unit.sessionDuration} onChange={(value) => patch({ sessionDuration: Number(value) })} />
      <Field label="Eje temático" value={unit.thematicAxis} onChange={(thematicAxis) => patch({ thematicAxis })} />
      <Field label="Obra o textos principales" value={unit.mainTexts} onChange={(mainTexts) => patch({ mainTexts })} />
      <Field label="Producto final" value={unit.finalProduct} onChange={(finalProduct) => patch({ finalProduct })} />
      <Field label="Autora" value={unit.author} onChange={(author) => patch({ author })} />
      <Field label="Curso académico" value={unit.academicYear} onChange={(academicYear) => patch({ academicYear })} />
      <label className="field"><span>Estado</span><select value={unit.status} onChange={(event) => patch({ status: event.target.value as Unit["status"] })}><option value="draft">Borrador</option><option value="review">En revisión</option><option value="complete">Completa</option></select></label>
    </div>
  </section>;
}

function toggle(list: string[], id: string) { return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]; }

function CurriculumPanel({ unit }: { unit: Unit }) {
  const [query, setQuery] = useState("");
  const filteredCriteria = (criteria as CurriculumItem[]).filter((item) => `${item.code} ${item.legalText}`.toLowerCase().includes(query.toLowerCase()));
  const selectedRelationships = (relationships as CurriculumRelationship[]).filter((item) => unit.selectedCriterionIds.includes(item.criterionId));
  const objectiveIds = [...new Set(selectedRelationships.map((item) => item.specificCompetenceId).filter(Boolean))];
  const descriptorIds = [...new Set(selectedRelationships.flatMap((item) => item.descriptorIds))];
  return <section>
    <PanelHeader eyebrow="Decreto 156/2022 · anexo II" title="Selección curricular" text="Los vínculos criterio–objetivo–descriptor son normativos. Los contenidos permanecen como selección manual porque la norma los agrupa por bloque." />
    <input className="search" placeholder="Buscar por código o texto…" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="curriculum-layout">
      <div>
        <h2>Criterios de evaluación</h2>
        <div className="curriculum-list">{filteredCriteria.map((item) => <label key={item.id} className="check-card">
          <input type="checkbox" checked={unit.selectedCriterionIds.includes(item.id)} onChange={() => updateUnit(unit.id, { selectedCriterionIds: toggle(unit.selectedCriterionIds, item.id) })} />
          <span><strong>{item.code}</strong>{item.legalText}</span>
        </label>)}</div>
      </div>
      <aside className="relation-panel">
        <h2>Relaciones automáticas</h2>
        <p><span className="relation-badge normative">Normativa</span> derivada del objetivo asociado al criterio.</p>
        <h3>Competencias específicas / objetivos</h3>
        {objectiveIds.length ? objectiveIds.map((id) => { const item = (competences as CurriculumItem[]).find((entry) => entry.id === id); return item && <p key={id}><strong>{item.code}</strong> {item.legalText}</p>; }) : <p className="muted">Selecciona un criterio.</p>}
        <h3>Descriptores operativos</h3>
        <div className="tag-list">{descriptorIds.map((id) => { const item = (descriptors as CurriculumItem[]).find((entry) => entry.id === id); return item && <span key={id}>{item.code}</span>; })}</div>
      </aside>
    </div>
    <h2>Competencias específicas / objetivos de materia</h2>
    <p className="muted">Se incorporan automáticamente las vinculadas a los criterios. También puedes seleccionar otras de forma manual.</p>
    <div className="curriculum-list curriculum-list--compact">{(competences as CurriculumItem[]).map((item) => {
      const automatic = objectiveIds.includes(item.id);
      const checked = automatic || unit.selectedCompetenceIds.includes(item.id);
      return <label key={item.id} className="check-card">
        <input type="checkbox" checked={checked} disabled={automatic} onChange={() => updateUnit(unit.id, { selectedCompetenceIds: toggle(unit.selectedCompetenceIds, item.id) })} />
        <span><strong>{item.code}</strong>{item.legalText}{automatic && <small className="automatic-note">Incluida por criterio seleccionado</small>}</span>
      </label>;
    })}</div>
    <h2>Objetivos de etapa</h2>
    <div className="curriculum-list curriculum-list--compact">{(stageObjectives as CurriculumItem[]).map((item) => <label key={item.id} className="check-card">
      <input type="checkbox" checked={unit.selectedStageObjectiveIds.includes(item.id)} onChange={() => updateUnit(unit.id, { selectedStageObjectiveIds: toggle(unit.selectedStageObjectiveIds, item.id) })} />
      <span><strong>{item.code})</strong>{item.legalText}</span>
    </label>)}</div>
    <h2>Contenidos</h2>
    {(blocks as CurriculumItem[]).map((block) => <div key={block.id} className="content-block"><h3>{block.code} · {block.legalText}</h3>
      {(contents as CurriculumItem[]).filter((item) => item.blockId === block.id).map((item) => <label key={item.id} className="check-card">
        <input type="checkbox" checked={unit.selectedContentIds.includes(item.id)} onChange={() => updateUnit(unit.id, { selectedContentIds: toggle(unit.selectedContentIds, item.id) })} />
        <span>{item.legalText}</span>
      </label>)}
    </div>)}
  </section>;
}

function SectionsPanel({ unit, sections }: { unit: Unit; sections: UnitSection[] }) {
  return <section>
    <PanelHeader eyebrow="Plantilla fija" title="Los doce apartados" text="El orden y la numeración están protegidos; el contenido interior es editable y puede bloquearse." />
    <div className="sections-stack">{sections.sort((a, b) => Object.keys(sectionTitles).indexOf(a.key) - Object.keys(sectionTitles).indexOf(b.key)).map((section, index) =>
      <article className="section-editor" key={section.id}>
        <header><div><span>{index + 1}</span><h2>{sectionTitles[section.key]}</h2></div><div className="row-actions">
          <label><input type="checkbox" checked={section.completed} onChange={(event) => updateSection(section.id, { completed: event.target.checked })} /> Completado</label>
          <label><input type="checkbox" checked={section.locked} onChange={(event) => updateSection(section.id, { locked: event.target.checked })} /> Bloqueado</label>
          <button className="button" disabled={section.locked} onClick={async () => {
            await updateSection(section.id, { generated: true, manuallyEdited: false });
            await refreshGeneratedSections(unit.id, [section.key]);
          }}>{section.manuallyEdited ? "Volver a automático" : "Actualizar ahora"}</button>
        </div></header>
        <RichTextEditor value={section.content} onChange={(content) => !section.locked && updateSection(section.id, { content, generated: false, manuallyEdited: true })} />
        <footer>{section.manuallyEdited ? "Edición manual: no se sobrescribe automáticamente" : "Sincronización automática activa"} · {section.sourceTemplate ?? "sin plantilla"}</footer>
      </article>)}</div>
  </section>;
}

function SortableSession({ session, unit, activities }: { session: Session; unit: Unit; activities: Activity[] }) {
  const sortable = useSortable({ id: session.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const sessionActivities = activities.filter((activity) => activity.sessionId === session.id).sort((a, b) => a.order - b.order);
  return <article ref={sortable.setNodeRef} style={style} className="session-card">
    <header><button className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label="Reordenar sesión">⋮⋮</button><span className="session-number">{session.order + 1}</span>
      <input className="title-input" value={session.title} onChange={(event) => updateSession(session.id, { title: event.target.value })} />
      <button className="button" onClick={() => updateSession(session.id, { collapsed: !session.collapsed })}>{session.collapsed ? "Abrir" : "Cerrar"}</button>
      <button className="button" onClick={() => duplicateSession(session)}>Duplicar</button>
      <button className="button button--danger" onClick={() => confirm("¿Eliminar esta sesión y sus actividades?") && removeSession(session.id)}>Eliminar</button>
    </header>
    {!session.collapsed && <div className="session-body">
      <div className="form-grid form-grid--dense">
        <Field label="Duración" type="number" min={1} value={session.duration} onChange={(value) => updateSession(session.id, { duration: Number(value) })} />
        <label className="field"><span>Fase</span><select value={session.phase} onChange={(event) => updateSession(session.id, { phase: event.target.value as Session["phase"] })}>{phases.map((phase) => <option key={phase}>{phase}</option>)}</select></label>
        <Field label="Función pedagógica" value={session.pedagogicalFunction} onChange={(pedagogicalFunction) => updateSession(session.id, { pedagogicalFunction })} />
        <Field label="Objetivo" value={session.objective} onChange={(objective) => updateSession(session.id, { objective })} />
        <Field label="Evidencia" value={session.evidence} onChange={(evidence) => updateSession(session.id, { evidence })} />
        <label className="field"><span>Exportación</span><select value={String(session.includeInExport)} onChange={(event) => updateSession(session.id, { includeInExport: event.target.value === "true" })}><option value="true">Visible</option><option value="false">Oculta</option></select></label>
      </div>
      <label className="field"><span>Descripción general</span><textarea value={session.description} onChange={(event) => updateSession(session.id, { description: event.target.value })} /></label>
      <AssociationPicker unit={unit} criterionIds={session.criterionIds} contentIds={session.contentIds} duaMeasures={session.duaMeasures}
        onCriteria={(criterionIds) => updateSession(session.id, { criterionIds })}
        onContents={(contentIds) => updateSession(session.id, { contentIds })}
        onDua={(duaMeasures) => updateSession(session.id, { duaMeasures })} />
      <h3>Actividades <small className="count-note">{sessionActivities.length}</small></h3>
      {!sessionActivities.length && <p className="empty-activities">Esta sesión todavía no tiene actividades. Añade la primera para redactar sus instrucciones y materiales.</p>}
      {sessionActivities.map((activity, index) => <ActivityEditor key={activity.id} unit={unit} activity={activity} index={index} siblings={sessionActivities} />)}
      <button className="button button--primary" onClick={() => addActivity(session.id)}>Añadir actividad</button>
    </div>}
  </article>;
}

function ActivityEditor({ unit, activity, index, siblings }: { unit: Unit; activity: Activity; index: number; siblings: Activity[] }) {
  const move = (direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    reorderActivities(arrayMove(siblings, index, target));
  };
  return <details className="activity-card" open={index === 0}>
    <summary><span>Actividad {index + 1}</span><strong>{activity.title}</strong></summary>
    <div className="activity-body">
      <div className="row-actions"><button className="button" onClick={() => move(-1)}>↑</button><button className="button" onClick={() => move(1)}>↓</button><button className="button button--danger" onClick={() => removeActivity(activity.id)}>Eliminar</button></div>
      <div className="form-grid form-grid--dense">
        <Field label="Título" value={activity.title} onChange={(title) => updateActivity(activity.id, { title })} />
        <label className="field"><span>Tipo</span><select value={activity.type} onChange={(event) => updateActivity(activity.id, { type: event.target.value })}>{activityTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <Field label="Duración" type="number" min={1} value={activity.duration} onChange={(value) => updateActivity(activity.id, { duration: Number(value) })} />
        <Field label="Agrupamiento" value={activity.grouping} onChange={(grouping) => updateActivity(activity.id, { grouping })} />
        <Field label="Finalidad didáctica" value={activity.purpose} onChange={(purpose) => updateActivity(activity.id, { purpose })} />
        <Field label="Evidencia / producto" value={activity.evidence} onChange={(evidence) => updateActivity(activity.id, { evidence })} />
        <label className="field"><span>Instrumento</span><select value={activity.assessmentInstrumentId ?? ""} onChange={(event) => updateActivity(activity.id, { assessmentInstrumentId: event.target.value || undefined })}><option value="">Sin instrumento</option>{["observación", "lista de control", "escala", "rúbrica", "prueba escrita", "exposición", "producción escrita", "portfolio", "autoevaluación", "coevaluación"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Exportación</span><select value={String(activity.includeInExport)} onChange={(event) => updateActivity(activity.id, { includeInExport: event.target.value === "true" })}><option value="true">Visible</option><option value="false">Oculta</option></select></label>
      </div>
      <label className="field"><span>Descripción docente</span><textarea value={activity.description} onChange={(event) => updateActivity(activity.id, { description: event.target.value })} /></label>
      <label className="field"><span>Instrucciones</span><textarea value={activity.instructions} onChange={(event) => updateActivity(activity.id, { instructions: event.target.value })} /></label>
      <span className="field-label">Material para el alumnado</span>
      <RichTextEditor value={activity.content} onChange={(content) => updateActivity(activity.id, { content })} />
      <AssociationPicker unit={unit} criterionIds={activity.criterionIds} contentIds={activity.contentIds} duaMeasures={activity.duaMeasures}
        onCriteria={(criterionIds) => updateActivity(activity.id, { criterionIds })}
        onContents={(contentIds) => updateActivity(activity.id, { contentIds })}
        onDua={(duaMeasures) => updateActivity(activity.id, { duaMeasures })} />
    </div>
  </details>;
}

function AssociationPicker({ unit, criterionIds, contentIds, duaMeasures, onCriteria, onContents, onDua }: {
  unit: Unit; criterionIds: string[]; contentIds: string[]; duaMeasures: string[];
  onCriteria: (ids: string[]) => void; onContents: (ids: string[]) => void; onDua: (items: string[]) => void;
}) {
  return <details className="association-picker"><summary>Relaciones curriculares y DUA</summary><div>
    <h4>Criterios</h4><div className="mini-checks">{unit.selectedCriterionIds.map((id) => { const item = (criteria as CurriculumItem[]).find((entry) => entry.id === id); return <label key={id}><input type="checkbox" checked={criterionIds.includes(id)} onChange={() => onCriteria(toggle(criterionIds, id))} />{item?.code}</label>; })}</div>
    <h4>Contenidos</h4><div className="mini-checks">{unit.selectedContentIds.map((id) => { const item = (contents as CurriculumItem[]).find((entry) => entry.id === id); return <label key={id}><input type="checkbox" checked={contentIds.includes(id)} onChange={() => onContents(toggle(contentIds, id))} />{item?.code}</label>; })}</div>
    <h4>Medidas DUA</h4><div className="mini-checks">{diversityMeasures.map((measure) => <label key={measure}><input type="checkbox" checked={duaMeasures.includes(measure)} onChange={() => onDua(toggle(duaMeasures, measure))} />{measure}</label>)}</div>
  </div></details>;
}

function SessionsPanel({ unit, sessions, activities }: { unit: Unit; sessions: Session[]; activities: Activity[] }) {
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sessions.findIndex((item) => item.id === active.id);
    const newIndex = sessions.findIndex((item) => item.id === over.id);
    reorderSessions(arrayMove(sessions, oldIndex, newIndex));
  };
  return <section>
    <PanelHeader eyebrow="Secuencia didáctica" title="Sesiones y actividades" text="Arrastra las sesiones para reordenarlas. La numeración de sesiones y actividades se calcula por posición." />
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={sessions.map((session) => session.id)} strategy={verticalListSortingStrategy}>
      {sessions.map((session) => <SortableSession key={session.id} session={session} unit={unit} activities={activities} />)}
    </SortableContext></DndContext>
    <button className="button button--primary add-session-button" onClick={() => addSession(unit)}>＋ Añadir otra sesión</button>
  </section>;
}

function AssessmentPanel({ unit, sessions, activities }: { unit: Unit; sessions: Session[]; activities: Activity[] }) {
  const selected = criteria as CurriculumItem[];
  return <section>
    <PanelHeader eyebrow="Trazabilidad" title="Matriz de evaluación" text="La matriz cruza criterios, sesiones, actividades, evidencias e instrumentos." />
    <div className="table-wrap"><table><thead><tr><th>Criterio</th><th>Sesión</th><th>Actividad</th><th>Evidencia</th><th>Instrumento</th></tr></thead><tbody>
      {unit.selectedCriterionIds.map((criterionId) => {
        const criterion = selected.find((item) => item.id === criterionId);
        const matches = activities.filter((activity) => activity.criterionIds.includes(criterionId));
        if (!matches.length) return <tr className="warning-row" key={criterionId}><td>{criterion?.code}</td><td colSpan={4}>Criterio seleccionado sin actividad asociada.</td></tr>;
        return matches.map((activity) => {
          const session = sessions.find((item) => item.id === activity.sessionId);
          return <tr key={`${criterionId}-${activity.id}`}><td>{criterion?.code}</td><td>{session ? session.order + 1 : "—"}</td><td>{activity.title}</td><td>{activity.evidence || "⚠ Sin evidencia"}</td><td>{activity.assessmentInstrumentId || "⚠ Sin instrumento"}</td></tr>;
        });
      })}
    </tbody></table></div>
    {!unit.selectedCriterionIds.length && <p className="empty-inline">Selecciona criterios en Currículo para construir la matriz.</p>}
  </section>;
}

function DiversityPanel({ unit }: { unit: Unit }) {
  return <section>
    <PanelHeader eyebrow="DUA · sin datos personales" title="Atención a la diversidad" text="Selecciona medidas reales de la unidad. Pueden concretarse después en sesiones y actividades." />
    <div className="profile-grid"><article><strong>TDAH</strong><p>Fragmentación, apoyos visuales, anticipación y tiempos ajustables.</p></article><article><strong>Dislexia</strong><p>Lectura segmentada, modelos, opción oral y menor carga visual.</p></article><article><strong>Altas capacidades</strong><p>Ampliación, enriquecimiento y productos abiertos.</p></article><article><strong>Incorporación tardía</strong><p>Glosario, apoyo visual, modelos lingüísticos y agrupamiento de apoyo.</p></article></div>
    <div className="measure-grid">{diversityMeasures.map((measure) => <label key={measure} className="check-card"><input type="checkbox" checked={unit.unitDiversityMeasures.includes(measure)} onChange={() => updateUnit(unit.id, { unitDiversityMeasures: toggle(unit.unitDiversityMeasures, measure) })} /><span>{measure}</span></label>)}</div>
  </section>;
}

function ResourcesPanel({ unit }: { unit: Unit }) {
  const assets = useLiveQuery(() => db.assets.where("unitId").equals(unit.id).toArray(), [unit.id]);
  const upload = async (file?: File) => {
    if (!file) return;
    const alt = prompt("Texto alternativo de la imagen:");
    if (!alt) return;
    await saveAsset(unit.id, file, alt, prompt("Pie de imagen (opcional):") || undefined, prompt("Fuente (opcional):") || undefined);
  };
  return <section>
    <PanelHeader eyebrow="Banco local" title="Recursos e imágenes" text="Las imágenes se redimensionan, comprimen y guardan como Blob en IndexedDB." />
    <label className="upload-box">Añadir imagen<input type="file" accept="image/*" onChange={(event) => upload(event.target.files?.[0])} /></label>
    <div className="asset-grid">{assets?.map((asset) => <figure key={asset.id}><img src={URL.createObjectURL(asset.blob)} alt={asset.alt} /><figcaption>{asset.caption || asset.alt}<small>{asset.width} × {asset.height}px</small><button className="button" onClick={() => updateUnit(unit.id, { coverAssetId: asset.id })}>{unit.coverAssetId === asset.id ? "Imagen de portada" : "Usar en portada"}</button></figcaption></figure>)}</div>
  </section>;
}

function DesignPanel({ unit }: { unit: Unit }) {
  return <section>
    <PanelHeader eyebrow="Sistema editorial" title="Diseño de la unidad" text="Un único tema sobrio y refinado, parametrizado por el color de la unidad." />
    <div className="form-grid">
      <label className="field"><span>Color de unidad</span><input type="color" value={unit.color} onChange={(event) => updateUnit(unit.id, { color: event.target.value })} /></label>
      <label className="field"><span>Tratamiento de portada</span><select value={unit.coverTreatment} onChange={(event) => updateUnit(unit.id, { coverTreatment: event.target.value as Unit["coverTreatment"] })}><option value="bleed">A sangre con velo</option><option value="blur">Desenfoque</option><option value="dark">Oscurecimiento</option><option value="band">Franja editorial</option><option value="none">Sin imagen</option></select></label>
      <Field label="Síntesis de contraportada" value={unit.backCoverSummary} onChange={(backCoverSummary) => updateUnit(unit.id, { backCoverSummary })} />
      <Field label="URL para QR opcional" type="url" value={unit.qrUrl} onChange={(qrUrl) => updateUnit(unit.id, { qrUrl })} />
    </div>
    <div className="cover-mini" style={{ background: unit.color }}><span>UNIDAD {unit.number}</span><h2>{unit.title}</h2><p>{unit.subtitle}</p><small>Lengua Castellana y Literatura · 4.º ESO</small></div>
  </section>;
}

function getWarnings(unit: Unit, sections: UnitSection[], sessions: Session[], activities: Activity[]) {
  const warnings: string[] = [];
  sections.filter((section) => !section.content.replace(/<[^>]+>/g, "").trim()).forEach((section) => warnings.push(`Apartado vacío: ${sectionTitles[section.key]}.`));
  sessions.filter((session) => !activities.some((activity) => activity.sessionId === session.id)).forEach((session) => warnings.push(`Sesión ${session.order + 1} sin actividades.`));
  activities.filter((activity) => !activity.purpose.trim()).forEach((activity) => warnings.push(`Actividad “${activity.title}” sin finalidad didáctica.`));
  unit.selectedCriterionIds.filter((id) => !sessions.some((session) => session.criterionIds.includes(id)) && !activities.some((activity) => activity.criterionIds.includes(id))).forEach((id) => {
    const item = (criteria as CurriculumItem[]).find((criterion) => criterion.id === id);
    warnings.push(`Criterio ${item?.code ?? id} no utilizado.`);
  });
  return warnings;
}

function ReviewPanel({ unit, sections, sessions, activities }: { unit: Unit; sections: UnitSection[]; sessions: Session[]; activities: Activity[] }) {
  const warnings = getWarnings(unit, sections, sessions, activities);
  return <section><PanelHeader eyebrow="Preflight" title="Revisión antes de exportar" text="Comprobaciones editoriales y curriculares que conviene resolver antes de imprimir." />
    {warnings.length ? <ul className="warning-list">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <div className="success-panel">No se han detectado incidencias estructurales.</div>}
  </section>;
}

function ExportPanel({ unit, sections, sessions, activities }: { unit: Unit; sections: UnitSection[]; sessions: Session[]; activities: Activity[] }) {
  const [paged, setPaged] = useState(false);
  return <section>
    <PanelHeader eyebrow="DIN A4 · CSS Paged Media" title="Vista previa y PDF" text="Esta es la vista que Nerea puede revisar. Para obtener el archivo PDF, usa «Guardar como PDF» en Chrome o Chromium y activa los gráficos de fondo." />
    <aside className="format-guide export-guide">
      <div><strong>PDF</strong><span>Documento final para leer, compartir, imprimir o enviar al tribunal.</span></div>
      <div><strong>.udpack</strong><span>Copia editable. No se abre con Word o Preview: se restaura desde la pantalla de inicio de esta aplicación.</span></div>
    </aside>
    <div className="export-actions"><button className="button button--primary" onClick={() => window.print()}>Guardar como PDF</button><button className="button" onClick={() => setPaged((value) => !value)}>{paged ? "Ocultar paginado" : "Ver paginado final"}</button><button className="button" onClick={() => exportUnitPackage(unit)}>Guardar copia editable (.udpack)</button></div>
    <PrintDocument unit={unit} sections={sections} sessions={sessions} activities={activities} />
    {paged && <PagedPreview />}
  </section>;
}

function PagedPreview() {
  const [status, setStatus] = useState("Componiendo páginas…");
  useEffect(() => {
    let cancelled = false;
    const output = document.getElementById("paged-output");
    const source = document.getElementById("print-document");
    if (!output || !source) return;
    output.innerHTML = "";
    import("pagedjs").then(async ({ Previewer }) => {
      const previewer = new Previewer();
      await previewer.preview(source.innerHTML, [], output);
      if (!cancelled) setStatus("");
    }).catch(() => !cancelled && setStatus("No se pudo generar el paginado; utiliza la impresión nativa."));
    return () => { cancelled = true; };
  }, []);
  return <div className="paged-preview no-print"><p>{status}</p><div id="paged-output" /></div>;
}

function PrintDocument({ unit, sections, sessions, activities }: { unit: Unit; sections: UnitSection[]; sessions: Session[]; activities: Activity[] }) {
  const orderedSections = sections.sort((a, b) => Object.keys(sectionTitles).indexOf(a.key) - Object.keys(sectionTitles).indexOf(b.key));
  return <div className="print-preview" id="print-document">
    <article className="print-page cover-page" style={{ "--unit-color": unit.color } as React.CSSProperties}>
      <CoverImage unit={unit} />
      <div className="cover-rule" /><p>UNIDAD DIDÁCTICA {String(unit.number).padStart(2, "0")}</p><h1>{unit.title}</h1><h2>{unit.subtitle}</h2>
      <dl><div><dt>Materia</dt><dd>Lengua Castellana y Literatura</dd></div><div><dt>Curso</dt><dd>4.º ESO</dd></div><div><dt>Evaluación</dt><dd>{unit.evaluation}</dd></div><div><dt>Sesiones</dt><dd>{sessions.length} × {unit.sessionDuration} min</dd></div></dl>
      <footer>{unit.author} · {unit.academicYear}</footer>
    </article>
    {orderedSections.map((section, index) => section.visible && <article className="print-page content-page" key={section.id}>
      <header className="running-header">UD {unit.number} · {unit.title}</header>
      <h1>{index + 1}. {sectionTitles[section.key]}</h1>
      {section.key === "stageObjectives" ? <LegalList ids={unit.selectedStageObjectiveIds} source={stageObjectives as CurriculumItem[]} /> :
       section.key === "unitObjectives" || section.key === "keyCompetences" ? <CurriculumRelationsPrint unit={unit} /> :
       section.key === "contents" ? <ContentsPrint unit={unit} /> :
       section.key === "learningSituation" ? <SessionPrint sessions={sessions} activities={activities} /> :
       section.key === "assessmentAndDiversity" ? <AssessmentPrint unit={unit} sessions={sessions} activities={activities} /> :
       <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />}
    </article>)}
    <article className="print-page back-cover" style={{ "--unit-color": unit.color } as React.CSSProperties}><span>UD {String(unit.number).padStart(2, "0")}</span><h1>{unit.title}</h1><p>{unit.backCoverSummary || unit.finalProduct || unit.thematicAxis}</p><dl><div><dt>Producto final</dt><dd>{unit.finalProduct || "Por definir"}</dd></div><div><dt>Sesiones</dt><dd>{sessions.length}</dd></div><div><dt>Versión</dt><dd>{new Date(unit.updatedAt).toLocaleDateString("es-ES")}</dd></div></dl><QrImage value={unit.qrUrl} /></article>
  </div>;
}

function CoverImage({ unit }: { unit: Unit }) {
  const asset = useLiveQuery(() => unit.coverAssetId ? db.assets.get(unit.coverAssetId) : undefined, [unit.coverAssetId]);
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!asset) return setUrl("");
    const next = URL.createObjectURL(asset.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [asset]);
  return url ? <img className={`cover-image cover-image--${unit.coverTreatment}`} src={url} alt={asset?.alt ?? ""} /> : null;
}

function QrImage({ value }: { value: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!value) return setSource("");
    QRCode.toDataURL(value, { width: 180, margin: 1, color: { dark: "#1f2b22", light: "#ffffff" } }).then(setSource).catch(() => setSource(""));
  }, [value]);
  return source ? <img className="qr-image" src={source} alt={`Código QR para ${value}`} /> : null;
}

function LegalList({ ids, source }: { ids: string[]; source: CurriculumItem[] }) {
  return <ul className="legal-list">{ids.map((id) => { const item = source.find((entry) => entry.id === id); return item && <li key={id}><strong>{item.code}</strong> {item.legalText}</li>; })}</ul>;
}

function CurriculumRelationsPrint({ unit }: { unit: Unit }) {
  const selectedCriteria = (criteria as CurriculumItem[]).filter((item) => unit.selectedCriterionIds.includes(item.id));
  const relationSource = relationships as CurriculumRelationship[];
  return <div className="table-wrap print-table"><table><thead><tr><th>Criterio</th><th>Objetivo de materia</th><th>Descriptores</th><th>Competencias clave</th><th>Tipo de relación</th></tr></thead><tbody>
    {selectedCriteria.map((criterion) => {
      const relation = relationSource.find((item) => item.criterionId === criterion.id);
      const competence = (competences as CurriculumItem[]).find((item) => item.id === relation?.specificCompetenceId);
      const descriptorItems = (descriptors as CurriculumItem[]).filter((item) => relation?.descriptorIds.includes(item.id));
      const keyCodes = [...new Set(descriptorItems.map((item) => item.code.match(/^[A-Z]+/)?.[0]).filter(Boolean))];
      return <tr key={criterion.id}><td><strong>{criterion.code}</strong><small>{criterion.legalText}</small></td><td>{competence?.code ?? "—"}</td><td>{descriptorItems.map((item) => item.code).join(", ") || "—"}</td><td>{keyCodes.join(", ") || "—"}</td><td><span className="relation-badge normative">Normativa</span></td></tr>;
    })}
    {!selectedCriteria.length && <tr><td colSpan={5}>Aún no hay criterios seleccionados.</td></tr>}
  </tbody></table></div>;
}

function ContentsPrint({ unit }: { unit: Unit }) {
  return <div className="table-wrap print-table"><table><thead><tr><th>Bloque</th><th>Contenido seleccionado</th><th>Selección</th></tr></thead><tbody>
    {(blocks as CurriculumItem[]).flatMap((block) => (contents as CurriculumItem[])
      .filter((item) => item.blockId === block.id && unit.selectedContentIds.includes(item.id))
      .map((item) => <tr key={item.id}><td><strong>{block.code}</strong><small>{block.legalText}</small></td><td>{item.legalText}</td><td><span className="relation-badge manual">Manual</span></td></tr>))}
    {!unit.selectedContentIds.length && <tr><td colSpan={3}>Aún no hay contenidos seleccionados.</td></tr>}
  </tbody></table></div>;
}

function AssessmentPrint({ unit, sessions, activities }: { unit: Unit; sessions: Session[]; activities: Activity[] }) {
  const rows = activities.flatMap((activity) => activity.criterionIds.map((criterionId) => ({
    activity,
    criterion: (criteria as CurriculumItem[]).find((item) => item.id === criterionId),
    session: sessions.find((item) => item.id === activity.sessionId)
  })));
  return <><div className="table-wrap print-table"><table><thead><tr><th>Criterio</th><th>Sesión</th><th>Actividad</th><th>Evidencia</th><th>Instrumento</th></tr></thead><tbody>
    {rows.map(({ activity, criterion, session }) => <tr key={`${activity.id}-${criterion?.id}`}><td>{criterion?.code}</td><td>{session ? session.order + 1 : "—"}</td><td>{activity.title}</td><td>{activity.evidence || "Pendiente"}</td><td>{activity.assessmentInstrumentId || "Pendiente"}</td></tr>)}
    {!rows.length && <tr><td colSpan={5}>Aún no existen asociaciones de evaluación.</td></tr>}
  </tbody></table></div><h2>Medidas de atención a la diversidad</h2><ul>{unit.unitDiversityMeasures.map((measure) => <li key={measure}>{measure}</li>)}</ul></>;
}

function SessionPrint({ sessions, activities }: { sessions: Session[]; activities: Activity[] }) {
  return <div>{sessions.filter((session) => session.includeInExport).map((session) => <section className="print-session" key={session.id}><h2>Sesión {session.order + 1}. {session.title}</h2><p>{session.description}</p>
    <table className="session-summary"><thead><tr><th>Fase</th><th>Duración</th><th>Objetivo</th><th>Evidencia</th></tr></thead><tbody><tr><td>{session.phase}</td><td>{session.duration} min</td><td>{session.objective}</td><td>{session.evidence}</td></tr></tbody></table>
    {activities.filter((activity) => activity.sessionId === session.id && activity.includeInExport).sort((a, b) => a.order - b.order).map((activity, index) => <article className="print-activity" key={activity.id}><h3>Actividad {index + 1}. {activity.title}</h3><p>{activity.description}</p><div className="purpose-box"><strong>Finalidad didáctica</strong>{activity.purpose}</div><div className="student-material" dangerouslySetInnerHTML={{ __html: activity.content }} /></article>)}
  </section>)}</div>;
}
