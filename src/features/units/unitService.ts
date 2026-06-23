import { db } from "../../db/database";
import {
  sectionKeys,
  sectionTitles,
  type Activity,
  type Asset,
  type Project,
  type Session,
  type Unit,
  type UnitSection
} from "../../schemas/domain";
import { now, uuid } from "../../utils/ids";
import { useUiStore } from "../../store/uiStore";
import stageObjectives from "../../data/curriculum/stage-objectives.json";
import criteria from "../../data/curriculum/assessment-criteria.json";
import contents from "../../data/curriculum/contents.json";
import contentBlocks from "../../data/curriculum/content-blocks.json";
import specificCompetences from "../../data/curriculum/specific-competences.json";
import descriptors from "../../data/curriculum/descriptors.json";
import keyCompetences from "../../data/curriculum/key-competences.json";
import relationships from "../../data/curriculum/relationships.json";
import type { CurriculumItem, CurriculumRelationship, SectionKey } from "../../schemas/domain";
import { filterContentIdsByCriteria } from "../curriculum/curriculumRules";
import { stageObjectivesIntro, unitObjectivesIntro } from "./templateCopy";

const schemaVersion = 1;

async function trackedSave(task: () => Promise<unknown>): Promise<void> {
  useUiStore.getState().setSaveState("saving");
  try {
    await task();
    useUiStore.getState().setSaveState("saved");
  } catch (error) {
    useUiStore.getState().setSaveState("error");
    throw error;
  }
}

const initialSession = ["Activación y contextualización", "activación"] as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function legalList(items: CurriculumItem[]): string {
  if (!items.length) return "<p><em>Aún no hay elementos seleccionados.</em></p>";
  return `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.legalText)}</li>`).join("")}</ul>`;
}

function selectedItems(ids: string[], source: CurriculumItem[]): CurriculumItem[] {
  const selected = new Set(ids);
  return source.filter((item) => selected.has(item.id));
}

function curriculumDerivation(unit: Unit) {
  const selectedRelations = (relationships as CurriculumRelationship[]).filter((item) => unit.selectedCriterionIds.includes(item.criterionId));
  const competenceIds = [...new Set([
    ...unit.selectedCompetenceIds,
    ...selectedRelations.map((item) => item.specificCompetenceId).filter((id): id is string => Boolean(id))
  ])];
  const descriptorIds = [...new Set(selectedRelations.flatMap((item) => item.descriptorIds))];
  const descriptorItems = selectedItems(descriptorIds, descriptors as CurriculumItem[]);
  const keyCodes = [...new Set(descriptorItems.map((item) => item.code.match(/^[A-Z]+/)?.[0]).filter((code): code is string => Boolean(code)))];
  return {
    stageObjectives: selectedItems(unit.selectedStageObjectiveIds, stageObjectives as CurriculumItem[]),
    criteria: selectedItems(unit.selectedCriterionIds, criteria as CurriculumItem[]),
    contents: selectedItems(unit.selectedContentIds, contents as CurriculumItem[]),
    competences: selectedItems(competenceIds, specificCompetences as CurriculumItem[]),
    descriptors: descriptorItems,
    keyCompetences: (keyCompetences as CurriculumItem[]).filter((item) => keyCodes.includes(item.code))
  };
}

async function generatedSectionContext(unit: Unit) {
  const sessions = await db.sessions.where("unitId").equals(unit.id).sortBy("order");
  const activities = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).sortBy("order")))).flat();
  return { sessions, activities };
}

async function sectionTemplate(key: SectionKey, unit: Unit): Promise<string> {
  const name = `<strong>${unit.title}</strong>`;
  const derived = curriculumDerivation(unit);
  const { sessions, activities } = await generatedSectionContext(unit);
  const groupedContents = (contentBlocks as CurriculumItem[]).map((block) => ({
    block,
    items: derived.contents.filter((item) => item.blockId === block.id)
  })).filter((group) => group.items.length);
  const sessionSummary = sessions.length
    ? `<ol>${sessions.map((session) => `<li><strong>Sesión ${session.order + 1}. ${escapeHtml(session.title)}</strong> (${session.duration} min). ${escapeHtml(session.objective || session.description || "Objetivo pendiente.")}</li>`).join("")}</ol>`
    : "<p><em>Aún no se han creado sesiones.</em></p>";
  const activitiesWithPurpose = activities.filter((activity) => activity.purpose.trim()).length;
  const templates: Record<SectionKey, string> = {
    introduction: `<p>En las siguientes páginas se desarrollan los contenidos, actividades y criterios de evaluación de la Unidad Didáctica ${unit.number}, ${name}, correspondiente a ${unit.evaluation} de 4.º de Educación Secundaria Obligatoria.</p><p>La unidad se articula alrededor de ${unit.thematicAxis || "un eje temático común"} y adopta un enfoque competencial, activo e inclusivo.</p>`,
    justification: `<p>La presente unidad didáctica se ajusta a la Ley Orgánica 3/2020 (LOMLOE) y al Decreto 156/2022, que regula el currículo de la Educación Secundaria Obligatoria en Galicia.</p><p>Su selección curricular comprende ${derived.criteria.length} criterios de evaluación, ${derived.contents.length} contenidos y ${derived.competences.length} objetivos de materia. Se aplicarán medidas basadas en el Diseño Universal para el Aprendizaje (DUA) para atender a la diversidad de ritmos, intereses y necesidades.</p>`,
    stageObjectives: `<p>${stageObjectivesIntro}</p>${legalList(derived.stageObjectives)}`,
    unitObjectives: `<p>${unitObjectivesIntro}</p>${legalList(derived.criteria)}<p><strong>Objetivos de materia relacionados</strong></p>${legalList(derived.competences)}`,
    contents: groupedContents.length ? groupedContents.map(({ block, items }) => `<h3>${escapeHtml(block.code)}. ${escapeHtml(block.legalText)}</h3>${legalList(items)}`).join("") : "<p><em>Aún no hay contenidos seleccionados.</em></p>",
    keyCompetences: `<p>Las relaciones normativas criterio → objetivo de materia → descriptor permiten derivar las siguientes competencias clave:</p>${legalList(derived.keyCompetences)}<p><strong>Descriptores operativos</strong></p>${legalList(derived.descriptors)}`,
    readingPlan: `<p>El Plan de Lectura se integra mediante textos literarios, divulgativos y multimodales relacionados con ${unit.thematicAxis || "el eje de la unidad"}.</p><p>Los textos principales previstos son: ${escapeHtml(unit.mainTexts || "por determinar")}.</p>`,
    interdisciplinarity: "<p>Describe las conexiones significativas con otras materias y evita relaciones meramente decorativas.</p>",
    methodology: `<p>La metodología será activa, participativa y centrada en el alumnado. La unidad se desarrollará durante ${sessions.length || unit.plannedSessions} sesiones de ${unit.sessionDuration} minutos y avanzará desde la activación hasta la producción y la evaluación.</p><p>El producto final será ${escapeHtml(unit.finalProduct || "determinado durante el diseño de la unidad")}.</p>`,
    learningSituation: `<p>La situación de aprendizaje se organiza en ${sessions.length} sesiones y ${activities.length} actividades:</p>${sessionSummary}`,
    assessmentAndDiversity: `<p>Se han seleccionado ${derived.criteria.length} criterios. La secuencia incluye ${activitiesWithPurpose} actividades con finalidad didáctica explícita y ${activities.filter((activity) => activity.evidence.trim()).length} evidencias definidas.</p><p><strong>Medidas de atención a la diversidad</strong></p>${unit.unitDiversityMeasures.length ? `<ul>${unit.unitDiversityMeasures.map((measure) => `<li>${escapeHtml(measure)}</li>`).join("")}</ul>` : "<p><em>Aún no hay medidas DUA seleccionadas.</em></p>"}`,
    conclusion: `<p>La unidad ${name} integra la educación lingüística y literaria alrededor de ${escapeHtml(unit.thematicAxis || "un eje temático coherente")}, con ${sessions.length} sesiones y el producto final «${escapeHtml(unit.finalProduct || "por definir")}». La propuesta favorece la autonomía, el pensamiento crítico y la transferencia de los aprendizajes.</p>`
  };
  return templates[key];
}

export async function refreshGeneratedSections(unitId: string, keys: SectionKey[] = [...sectionKeys]): Promise<void> {
  const unit = await db.units.get(unitId);
  if (!unit) return;
  const sections = await db.unitSections.where("unitId").equals(unitId).toArray();
  const eligible = sections.filter((section) => keys.includes(section.key) && section.generated && !section.manuallyEdited && !section.locked);
  if (!eligible.length) return;
  await db.unitSections.bulkPut(await Promise.all(eligible.map(async (section) => ({
    ...section,
    content: await sectionTemplate(section.key, unit),
    updatedAt: now()
  }))));
}

export async function ensureDefaultProject(): Promise<Project> {
  const existing = await db.projects.orderBy("updatedAt").last();
  if (existing) return existing;
  const timestamp = now();
  const project: Project = {
    id: uuid(),
    name: "Programación de Lengua Castellana y Literatura · 4.º ESO",
    author: "Nerea Bouzas",
    academicYear: "2026/2027",
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion
  };
  await db.projects.add(project);
  return project;
}

export async function createUnit(projectId: string, seed?: Partial<Unit>): Promise<Unit> {
  const timestamp = now();
  const selectedCriterionIds = seed?.selectedCriterionIds ?? [];
  const unit: Unit = {
    id: uuid(),
    projectId,
    number: seed?.number ?? ((await db.units.where("projectId").equals(projectId).count()) + 1),
    title: seed?.title ?? "Nueva unidad",
    subtitle: seed?.subtitle ?? "",
    evaluation: seed?.evaluation ?? "1.ª evaluación",
    startDate: seed?.startDate ?? "",
    endDate: seed?.endDate ?? "",
    plannedSessions: seed?.plannedSessions ?? 1,
    sessionDuration: seed?.sessionDuration ?? 50,
    thematicAxis: seed?.thematicAxis ?? "",
    mainTexts: seed?.mainTexts ?? "",
    finalProduct: seed?.finalProduct ?? "",
    color: seed?.color ?? "#8f4b3e",
    coverTreatment: seed?.coverTreatment ?? "band",
    author: seed?.author ?? "Nerea Bouzas",
    academicYear: seed?.academicYear ?? "2026/2027",
    status: seed?.status ?? "draft",
    selectedStageObjectiveIds: seed?.selectedStageObjectiveIds ?? [],
    selectedCompetenceIds: seed?.selectedCompetenceIds ?? [],
    selectedCriterionIds,
    selectedContentIds: filterContentIdsByCriteria(seed?.selectedContentIds ?? [], selectedCriterionIds),
    unitDiversityMeasures: seed?.unitDiversityMeasures ?? [],
    backCoverSummary: seed?.backCoverSummary ?? "",
    qrUrl: seed?.qrUrl ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion
  };
  const sections: UnitSection[] = await Promise.all(sectionKeys.map(async (key) => ({
    id: uuid(),
    unitId: unit.id,
    key,
    content: await sectionTemplate(key, unit),
    completed: false,
    generated: true,
    sourceTemplate: `default:${key}:v1`,
    manuallyEdited: false,
    locked: false,
    visible: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion
  })));
  const sessions: Session[] = [{
    id: uuid(),
    unitId: unit.id,
    order: 0,
    title: initialSession[0],
    duration: unit.sessionDuration,
    phase: initialSession[1],
    pedagogicalFunction: initialSession[0],
    objective: "",
    description: "",
    groupings: ["Individual", "Parejas", "Gran grupo"],
    methodologies: ["Aprendizaje activo"],
    skills: [],
    criterionIds: [],
    contentIds: [],
    resources: "",
    evidence: "",
    duaMeasures: [],
    teacherNotes: "",
    collapsed: false,
    includeInExport: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion
  }];
  await db.transaction("rw", db.units, db.unitSections, db.sessions, async () => {
    await db.units.add(unit);
    await db.unitSections.bulkAdd(sections);
    await db.sessions.bulkAdd(sessions);
  });
  await refreshGeneratedSections(unit.id);
  return unit;
}

export async function updateUnit(id: string, changes: Partial<Unit>): Promise<void> {
  await trackedSave(async () => {
    const current = await db.units.get(id);
    const criterionIds = changes.selectedCriterionIds ?? current?.selectedCriterionIds ?? [];
    const contentIds = changes.selectedContentIds ?? current?.selectedContentIds ?? [];
    const curriculumChanges = changes.selectedCriterionIds || changes.selectedContentIds
      ? { selectedContentIds: filterContentIdsByCriteria(contentIds, criterionIds) }
      : {};
    await db.units.update(id, { ...changes, ...curriculumChanges, updatedAt: now() });
    if (changes.selectedCriterionIds || changes.selectedContentIds) {
      const allowedCriterionIds = new Set(criterionIds);
      const allowedContentIds = new Set(curriculumChanges.selectedContentIds ?? contentIds);
      const sessions = await db.sessions.where("unitId").equals(id).toArray();
      const activities = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).toArray()))).flat();
      await db.sessions.bulkPut(sessions.map((session) => ({
        ...session,
        criterionIds: session.criterionIds.filter((criterionId) => allowedCriterionIds.has(criterionId)),
        contentIds: session.contentIds.filter((contentId) => allowedContentIds.has(contentId)),
        updatedAt: now()
      })));
      await db.activities.bulkPut(activities.map((activity) => ({
        ...activity,
        criterionIds: activity.criterionIds.filter((criterionId) => allowedCriterionIds.has(criterionId)),
        contentIds: activity.contentIds.filter((contentId) => allowedContentIds.has(contentId)),
        updatedAt: now()
      })));
    }
    if (changes.sessionDuration) {
      const sessions = await db.sessions.where("unitId").equals(id).toArray();
      await db.sessions.bulkPut(sessions.map((session) => ({ ...session, duration: changes.sessionDuration!, updatedAt: now() })));
    }
  });
  await refreshGeneratedSections(id);
}

export async function updateSection(id: string, changes: Partial<UnitSection>): Promise<void> {
  await trackedSave(() => db.unitSections.update(id, { ...changes, updatedAt: now() }));
}

export async function addSession(unit: Unit): Promise<Session> {
  const order = await db.sessions.where("unitId").equals(unit.id).count();
  const timestamp = now();
  const session: Session = {
    id: uuid(), unitId: unit.id, order, title: `Sesión ${order + 1}`, duration: unit.sessionDuration,
    phase: "desarrollo", pedagogicalFunction: "", objective: "", description: "", groupings: [],
    methodologies: [], skills: [], criterionIds: [], contentIds: [], resources: "", evidence: "",
    duaMeasures: [], teacherNotes: "", collapsed: false, includeInExport: true,
    createdAt: timestamp, updatedAt: timestamp, schemaVersion
  };
  await db.transaction("rw", db.sessions, db.units, async () => {
    const previous = await db.sessions.where("unitId").equals(unit.id).toArray();
    await db.sessions.bulkPut(previous.map((item) => ({ ...item, collapsed: true, updatedAt: now() })));
    await db.sessions.add(session);
    await db.units.update(unit.id, { plannedSessions: order + 1, updatedAt: now() });
  });
  await refreshGeneratedSections(unit.id, ["methodology", "learningSituation", "assessmentAndDiversity", "conclusion"]);
  return session;
}

export async function updateSession(id: string, changes: Partial<Session>): Promise<void> {
  await trackedSave(() => db.sessions.update(id, { ...changes, updatedAt: now() }));
  const session = await db.sessions.get(id);
  if (session) await refreshGeneratedSections(session.unitId, ["methodology", "learningSituation", "assessmentAndDiversity", "conclusion"]);
}

export async function removeSession(id: string): Promise<void> {
  const session = await db.sessions.get(id);
  const activityIds = (await db.activities.where("sessionId").equals(id).primaryKeys()) as string[];
  await db.transaction("rw", db.sessions, db.activities, async () => {
    await db.activities.bulkDelete(activityIds);
    await db.sessions.delete(id);
  });
  if (session) {
    const count = await db.sessions.where("unitId").equals(session.unitId).count();
    await db.units.update(session.unitId, { plannedSessions: Math.max(1, count), updatedAt: now() });
    await refreshGeneratedSections(session.unitId, ["methodology", "learningSituation", "assessmentAndDiversity", "conclusion"]);
  }
}

export async function duplicateSession(source: Session): Promise<Session> {
  const order = await db.sessions.where("unitId").equals(source.unitId).count();
  const timestamp = now();
  const copy: Session = { ...source, id: uuid(), order, title: `${source.title} · copia`, createdAt: timestamp, updatedAt: timestamp };
  const sourceActivities = await db.activities.where("sessionId").equals(source.id).sortBy("order");
  const copies = sourceActivities.map((activity) => ({
    ...activity,
    id: uuid(),
    sessionId: copy.id,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  await db.transaction("rw", db.sessions, db.activities, async () => {
    await db.sessions.add(copy);
    await db.activities.bulkAdd(copies);
  });
  await refreshGeneratedSections(source.unitId, ["methodology", "learningSituation", "assessmentAndDiversity", "conclusion"]);
  return copy;
}

export async function reorderSessions(items: Session[]): Promise<void> {
  await trackedSave(() => db.sessions.bulkPut(items.map((item, order) => ({ ...item, order, updatedAt: now() }))));
  if (items[0]) await refreshGeneratedSections(items[0].unitId, ["learningSituation"]);
}

export async function addActivity(sessionId: string): Promise<Activity> {
  const order = await db.activities.where("sessionId").equals(sessionId).count();
  const timestamp = now();
  const activity: Activity = {
    id: uuid(), sessionId, order, title: `Actividad ${order + 1}`, type: "actividad libre", duration: 15,
    purpose: "", description: "", instructions: "", content: "<p>Escribe aquí el material para el alumnado.</p>",
    grouping: "Individual", methodology: "", cognitiveProcess: "comprender", didacticFunction: "adquisición",
    resources: "", evidence: "", criterionIds: [], contentIds: [], duaMeasures: [], teacherNotes: "",
    media: [], includeInExport: true, createdAt: timestamp, updatedAt: timestamp, schemaVersion
  };
  await db.activities.add(activity);
  const session = await db.sessions.get(sessionId);
  if (session) await refreshGeneratedSections(session.unitId, ["learningSituation", "assessmentAndDiversity"]);
  return activity;
}

export async function updateActivity(id: string, changes: Partial<Activity>): Promise<void> {
  await trackedSave(() => db.activities.update(id, { ...changes, updatedAt: now() }));
  const activity = await db.activities.get(id);
  const session = activity ? await db.sessions.get(activity.sessionId) : undefined;
  if (session) await refreshGeneratedSections(session.unitId, ["learningSituation", "assessmentAndDiversity"]);
}

export async function removeActivity(id: string): Promise<void> {
  const activity = await db.activities.get(id);
  await db.activities.delete(id);
  const session = activity ? await db.sessions.get(activity.sessionId) : undefined;
  if (session) await refreshGeneratedSections(session.unitId, ["learningSituation", "assessmentAndDiversity"]);
}

export async function reorderActivities(items: Activity[]): Promise<void> {
  await trackedSave(() => db.activities.bulkPut(items.map((item, order) => ({ ...item, order, updatedAt: now() }))));
  const session = items[0] ? await db.sessions.get(items[0].sessionId) : undefined;
  if (session) await refreshGeneratedSections(session.unitId, ["learningSituation"]);
}

export async function duplicateUnit(source: Unit): Promise<Unit> {
  const copy = await createUnit(source.projectId, { ...source, title: `${source.title} · copia` });
  const sourceSections = await db.unitSections.where("unitId").equals(source.id).toArray();
  const copySections = await db.unitSections.where("unitId").equals(copy.id).toArray();
  const defaultSessions = await db.sessions.where("unitId").equals(copy.id).toArray();
  const sourceSessions = await db.sessions.where("unitId").equals(source.id).sortBy("order");
  const timestamp = now();
  const sessionMap = new Map<string, string>();
  const sessionCopies = sourceSessions.map((session) => {
    const id = uuid();
    sessionMap.set(session.id, id);
    return { ...session, id, unitId: copy.id, createdAt: timestamp, updatedAt: timestamp };
  });
  const sourceActivities = (await Promise.all(sourceSessions.map((session) => db.activities.where("sessionId").equals(session.id).sortBy("order")))).flat();
  const sourceAssets = await db.assets.where("unitId").equals(source.id).toArray();
  const assetMap = new Map<string, string>();
  const assetCopies: Asset[] = sourceAssets.map((asset) => {
    const id = uuid();
    assetMap.set(asset.id, id);
    return { ...asset, id, unitId: copy.id, createdAt: timestamp, updatedAt: timestamp };
  });
  const activityCopies = sourceActivities.map((activity) => ({
    ...activity,
    id: uuid(),
    sessionId: sessionMap.get(activity.sessionId)!,
    media: (activity.media ?? []).map((media) => ({
      ...media,
      assetId: media.assetId ? assetMap.get(media.assetId) : undefined,
      thumbnailAssetId: media.thumbnailAssetId ? assetMap.get(media.thumbnailAssetId) : undefined
    })),
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  await Promise.all(copySections.map((section) => {
    const original = sourceSections.find((item) => item.key === section.key);
    return original ? updateSection(section.id, { ...original, id: section.id, unitId: copy.id }) : Promise.resolve();
  }));
  await db.transaction("rw", db.units, db.sessions, db.activities, db.assets, async () => {
    await db.sessions.bulkDelete(defaultSessions.map((session) => session.id));
    await db.sessions.bulkAdd(sessionCopies);
    await db.activities.bulkAdd(activityCopies);
    if (assetCopies.length) await db.assets.bulkAdd(assetCopies);
    await db.units.update(copy.id, {
      coverAssetId: source.coverAssetId ? assetMap.get(source.coverAssetId) : undefined,
      updatedAt: timestamp
    });
  });
  await refreshGeneratedSections(copy.id);
  return copy;
}

export async function createDemoUnit(projectId: string): Promise<Unit> {
  const unit = await createUnit(projectId, {
    number: 1,
    title: "El mundo está loco… o quizá no",
    subtitle: "Lengua, crítica social y construcción de la normalidad",
    evaluation: "1.ª evaluación",
    thematicAxis: "La locura como forma de crítica social",
    mainTexts: "Don Quijote de la Mancha; Luces de Bohemia; textos divulgativos sobre diversidad lingüística",
    finalProduct: "Texto expositivo y presentación oral",
    color: "#8f4b3e",
    selectedStageObjectiveIds: ["stage-a", "stage-b", "stage-e", "stage-g", "stage-h", "stage-j", "stage-m"],
    selectedCriterionIds: ["criterion-ce1-1", "criterion-ce1-2", "criterion-ce2-3", "criterion-ce3-3", "criterion-ce3-7", "criterion-ce4-7", "criterion-ce5-4"],
    selectedContentIds: ["content-b1-1", "content-b2-1", "content-b3-1", "content-b4-1", "content-b5-1"]
  });
  const demoSessions = [
    ["Lenguas de España", "Activar conocimientos previos y valorar la diversidad lingüística."],
    ["El texto expositivo", "Reconocer estructura, objetividad y organización de la información."],
    ["Literatura y crítica social", "Interpretar la locura como recurso de cuestionamiento social."],
    ["Conectores y palabras invariables", "Aplicar mecanismos de cohesión y reflexión lingüística."],
    ["Planificación del texto expositivo", "Organizar ideas, fuentes y estructura antes de redactar."],
    ["Producción oral y reflexión final", "Compartir el producto y revisar el proceso de aprendizaje."]
  ];
  for (let index = 1; index < demoSessions.length; index += 1) await addSession(unit);
  const sessions = await db.sessions.where("unitId").equals(unit.id).sortBy("order");
  await Promise.all(sessions.map((session, index) => updateSession(session.id, {
    title: demoSessions[index][0],
    objective: demoSessions[index][1],
    description: `La sesión avanza mediante actividades de análisis, aplicación y puesta en común. ${demoSessions[index][1]}`,
    evidence: index === 5 ? "Presentación oral y autoevaluación" : "Producciones del cuaderno de aula",
    criterionIds: index === 0 ? ["criterion-ce1-1", "criterion-ce1-2"] : []
  })));
  const firstSession = sessions[0];
  const demoActivities = [
    ["¿Qué lenguas llevas encima sin saberlo?", "lectura", "Activar conocimientos previos y tomar conciencia de la diversidad lingüística.", "<p>Lee un texto divulgativo sobre las lenguas de España y responde a seis preguntas de comprensión y reflexión.</p>"],
    ["Un mapa para no perderse", "cooperativa", "Relacionar lengua, territorio e identidad cultural.", "<p>Completa por parejas un mapa lingüístico de España e incorpora una breve leyenda explicativa.</p>"],
    ["¿Es fiable lo que has encontrado?", "comparación de fuentes", "Desarrollar el pensamiento crítico y contrastar la fiabilidad de fuentes digitales.", "<p>Compara tres fuentes atendiendo a autoría, intención, evidencias y actualidad.</p>"]
  ];
  for (const [title, type, purpose, content] of demoActivities) {
    const activity = await addActivity(firstSession.id);
    await updateActivity(activity.id, {
      title,
      type,
      purpose,
      content,
      evidence: "Respuestas razonadas y puesta en común",
      criterionIds: ["criterion-ce1-1", "criterion-ce1-2"]
    });
  }
  await refreshGeneratedSections(unit.id);
  return unit;
}

export async function deleteUnit(id: string): Promise<void> {
  const sessions = await db.sessions.where("unitId").equals(id).toArray();
  const activityIds = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).primaryKeys()))).flat() as string[];
  await db.transaction("rw", db.units, db.unitSections, db.sessions, db.activities, db.assets, async () => {
    await db.activities.bulkDelete(activityIds);
    await db.sessions.where("unitId").equals(id).delete();
    await db.unitSections.where("unitId").equals(id).delete();
    await db.assets.where("unitId").equals(id).delete();
    await db.units.delete(id);
  });
}

export { sectionTemplate, sectionTitles };
