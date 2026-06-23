import Dexie, { type EntityTable } from "dexie";
import type { Activity, Asset, Project, Session, Unit, UnitSection } from "../schemas/domain";

export interface StoredRelation {
  id: string;
  unitId: string;
  criterionId: string;
  contentId?: string;
  relationType: "normative" | "suggested" | "manual";
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface AssessmentInstrument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  definition: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface VersionRecord {
  id: string;
  unitId: string;
  label: string;
  snapshot: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface SettingRecord {
  id: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export class PrograDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  units!: EntityTable<Unit, "id">;
  unitSections!: EntityTable<UnitSection, "id">;
  sessions!: EntityTable<Session, "id">;
  activities!: EntityTable<Activity, "id">;
  assets!: EntityTable<Asset, "id">;
  curriculumRelations!: EntityTable<StoredRelation, "id">;
  assessmentInstruments!: EntityTable<AssessmentInstrument, "id">;
  versions!: EntityTable<VersionRecord, "id">;
  settings!: EntityTable<SettingRecord, "id">;

  constructor() {
    super("progra-nerea");
    this.version(1).stores({
      projects: "id, updatedAt",
      units: "id, projectId, updatedAt, number",
      unitSections: "id, unitId, [unitId+key], updatedAt",
      sessions: "id, unitId, [unitId+order], updatedAt",
      activities: "id, sessionId, [sessionId+order], updatedAt",
      assets: "id, unitId, updatedAt",
      curriculumRelations: "id, unitId, criterionId, updatedAt",
      assessmentInstruments: "id, projectId, type, updatedAt",
      versions: "id, unitId, createdAt",
      settings: "id, updatedAt"
    });
  }
}

export const db = new PrograDatabase();
