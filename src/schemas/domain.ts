import { z } from "zod";

export const sectionKeys = [
  "introduction",
  "justification",
  "stageObjectives",
  "unitObjectives",
  "contents",
  "keyCompetences",
  "readingPlan",
  "interdisciplinarity",
  "methodology",
  "learningSituation",
  "assessmentAndDiversity",
  "conclusion"
] as const;

export type SectionKey = (typeof sectionKeys)[number];

export const sectionTitles: Record<SectionKey, string> = {
  introduction: "Introducción",
  justification: "Justificación",
  stageObjectives: "Objetivos de etapa",
  unitObjectives: "Objetivos didácticos de la unidad",
  contents: "Contenidos",
  keyCompetences: "Competencias clave",
  readingPlan: "Plan de lectura",
  interdisciplinarity: "Interdisciplinariedad",
  methodology: "Metodología, actividades y temporalización",
  learningSituation: "Situación de aprendizaje y desarrollo de las sesiones",
  assessmentAndDiversity: "Evaluación y atención a la diversidad",
  conclusion: "Conclusión"
};

const baseEntity = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int().positive()
});

export const projectSchema = baseEntity.extend({
  name: z.string().min(1),
  author: z.string().default("Nerea Bouzas"),
  academicYear: z.string().default("2026/2027"),
  lastBackupAt: z.string().optional()
});

export const unitSchema = baseEntity.extend({
  projectId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  evaluation: z.string().default("1.ª evaluación"),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  plannedSessions: z.number().int().positive().default(6),
  sessionDuration: z.number().int().positive().default(50),
  thematicAxis: z.string().default(""),
  mainTexts: z.string().default(""),
  finalProduct: z.string().default(""),
  color: z.string().default("#8f4b3e"),
  coverAssetId: z.string().uuid().optional(),
  coverTreatment: z.enum(["bleed", "blur", "dark", "band", "none"]).default("band"),
  author: z.string().default("Nerea Bouzas"),
  academicYear: z.string().default("2026/2027"),
  status: z.enum(["draft", "review", "complete"]).default("draft"),
  selectedStageObjectiveIds: z.array(z.string()).default([]),
  selectedCompetenceIds: z.array(z.string()).default([]),
  selectedCriterionIds: z.array(z.string()).default([]),
  selectedContentIds: z.array(z.string()).default([]),
  unitDiversityMeasures: z.array(z.string()).default([]),
  backCoverSummary: z.string().default(""),
  qrUrl: z.string().default("")
});

export const sectionSchema = baseEntity.extend({
  unitId: z.string().uuid(),
  key: z.enum(sectionKeys),
  content: z.string(),
  completed: z.boolean().default(false),
  generated: z.boolean().default(true),
  sourceTemplate: z.string().optional(),
  manuallyEdited: z.boolean().default(false),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true)
});

export const sessionPhaseSchema = z.enum([
  "activación", "exploración", "desarrollo", "práctica guiada", "aplicación",
  "producción", "evaluación", "cierre", "refuerzo", "ampliación"
]);

export const sessionSchema = baseEntity.extend({
  unitId: z.string().uuid(),
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  duration: z.number().int().positive(),
  phase: sessionPhaseSchema,
  pedagogicalFunction: z.string().default(""),
  objective: z.string().default(""),
  description: z.string().default(""),
  groupings: z.array(z.string()).default([]),
  methodologies: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  criterionIds: z.array(z.string()).default([]),
  contentIds: z.array(z.string()).default([]),
  resources: z.string().default(""),
  evidence: z.string().default(""),
  duaMeasures: z.array(z.string()).default([]),
  teacherNotes: z.string().default(""),
  collapsed: z.boolean().default(false),
  includeInExport: z.boolean().default(true)
});

export const activitySchema = baseEntity.extend({
  sessionId: z.string().uuid(),
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  type: z.string().default("actividad libre"),
  duration: z.number().int().positive().default(15),
  purpose: z.string().default(""),
  description: z.string().default(""),
  instructions: z.string().default(""),
  content: z.string().default(""),
  grouping: z.string().default("Individual"),
  methodology: z.string().default(""),
  cognitiveProcess: z.enum(["recordar", "comprender", "aplicar", "analizar", "evaluar", "crear"]).default("comprender"),
  didacticFunction: z.string().default("adquisición"),
  resources: z.string().default(""),
  evidence: z.string().default(""),
  criterionIds: z.array(z.string()).default([]),
  contentIds: z.array(z.string()).default([]),
  assessmentInstrumentId: z.string().optional(),
  duaMeasures: z.array(z.string()).default([]),
  teacherNotes: z.string().default(""),
  media: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(["image", "video", "file", "link"]),
    title: z.string().default(""),
    assetId: z.string().uuid().optional(),
    thumbnailAssetId: z.string().uuid().optional(),
    thumbnailUrl: z.string().optional(),
    url: z.string().optional(),
    mimeType: z.string().optional(),
    alt: z.string().default(""),
    caption: z.string().default("")
  })).default([]),
  includeInExport: z.boolean().default(true)
});

export type Project = z.infer<typeof projectSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type UnitSection = z.infer<typeof sectionSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ActivityMedia = Activity["media"][number];

export interface Asset {
  id: string;
  unitId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  width?: number;
  height?: number;
  alt: string;
  caption?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface CurriculumItem {
  id: string;
  code: string;
  legalText: string;
  shortLabel?: string;
  sourceReference?: string;
  specificCompetenceId?: string;
  blockId?: string;
}

export interface CurriculumRelationship {
  id: string;
  criterionId: string;
  specificCompetenceId?: string;
  descriptorIds: string[];
  contentIds: string[];
  relationType: "normative" | "suggested" | "manual";
  sourceReference?: string;
  note?: string;
}
