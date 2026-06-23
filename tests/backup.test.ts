import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { db } from "../src/db/database";
import { buildUnitPackage, importUnitPackage } from "../src/features/backup/backupService";

const projectId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-06-23T09:00:00.000Z";

describe("copias de unidad", () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.projects.add({
      id: projectId, name: "Prueba", author: "Nerea", academicYear: "2026/2027",
      createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
    });
  });

  it("importa un .udpack como copia con nuevos UUID", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: "udpack", version: 1 }));
    zip.file("unit.json", JSON.stringify({
      unit: {
        id: unitId, projectId, number: 1, title: "Unidad empaquetada", subtitle: "", evaluation: "1.ª evaluación",
        startDate: "", endDate: "", plannedSessions: 6, sessionDuration: 50, thematicAxis: "", mainTexts: "",
        finalProduct: "", color: "#8f4b3e", coverTreatment: "band", author: "Nerea", academicYear: "2026/2027",
        status: "draft", selectedStageObjectiveIds: [], selectedCompetenceIds: [], selectedCriterionIds: [],
        selectedContentIds: [], unitDiversityMeasures: [], backCoverSummary: "", qrUrl: "",
        createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      },
      sections: [],
      sessions: [{
        id: sessionId, unitId, order: 0, title: "Sesión", duration: 50, phase: "activación",
        pedagogicalFunction: "", objective: "", description: "", groupings: [], methodologies: [], skills: [],
        criterionIds: [], contentIds: [], resources: "", evidence: "", duaMeasures: [], teacherNotes: "",
        collapsed: false, includeInExport: true, createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      }],
      activities: []
    }));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([bytes], "unidad.udpack");

    const importedId = await importUnitPackage(file, projectId);
    const imported = await db.units.get(importedId);
    const importedSessions = await db.sessions.where("unitId").equals(importedId).toArray();

    expect(importedId).not.toBe(unitId);
    expect(imported?.title).toContain("importada");
    expect(importedSessions).toHaveLength(1);
    expect(importedSessions[0].id).not.toBe(sessionId);
  });

  it("genera el ZIP mínimo requerido", async () => {
    const unit = {
      id: unitId, projectId, number: 1, title: "Unidad", subtitle: "", evaluation: "1.ª evaluación",
      startDate: "", endDate: "", plannedSessions: 6, sessionDuration: 50, thematicAxis: "", mainTexts: "",
      finalProduct: "", color: "#8f4b3e", coverTreatment: "band" as const, author: "Nerea", academicYear: "2026/2027",
      status: "draft" as const, selectedStageObjectiveIds: [], selectedCompetenceIds: [], selectedCriterionIds: [],
      selectedContentIds: [], unitDiversityMeasures: [], backCoverSummary: "", qrUrl: "",
      createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
    };
    await db.units.add(unit);
    const bytes = await buildUnitPackage(unit);
    const archive = await JSZip.loadAsync(bytes);

    expect(archive.file("manifest.json")).not.toBeNull();
    expect(archive.file("unit.json")).not.toBeNull();
    expect(archive.file("preview.png")).not.toBeNull();
    expect(archive.folder("assets")).not.toBeNull();
  });

  it("restaura los archivos vinculados a una actividad", async () => {
    const activityId = "44444444-4444-4444-8444-444444444444";
    const assetId = "55555555-5555-4555-8555-555555555555";
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: "udpack", version: 1 }));
    zip.file("unit.json", JSON.stringify({
      unit: {
        id: unitId, projectId, number: 1, title: "Unidad con medios", subtitle: "", evaluation: "1.ª evaluación",
        startDate: "", endDate: "", plannedSessions: 1, sessionDuration: 50, thematicAxis: "", mainTexts: "",
        finalProduct: "", color: "#8f4b3e", coverTreatment: "band", author: "Nerea", academicYear: "2026/2027",
        status: "draft", selectedStageObjectiveIds: [], selectedCompetenceIds: [], selectedCriterionIds: [],
        selectedContentIds: [], unitDiversityMeasures: [], backCoverSummary: "", qrUrl: "",
        createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      },
      sections: [],
      sessions: [{
        id: sessionId, unitId, order: 0, title: "Sesión", duration: 50, phase: "activación",
        pedagogicalFunction: "", objective: "", description: "", groupings: [], methodologies: [], skills: [],
        criterionIds: [], contentIds: [], resources: "", evidence: "", duaMeasures: [], teacherNotes: "",
        collapsed: false, includeInExport: true, createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      }],
      activities: [{
        id: activityId, sessionId, order: 0, title: "Actividad", type: "digital", duration: 15,
        purpose: "", description: "", instructions: "", content: "", grouping: "Individual", methodology: "",
        cognitiveProcess: "comprender", didacticFunction: "adquisición", resources: "", evidence: "",
        criterionIds: [], contentIds: [], duaMeasures: [], teacherNotes: "", includeInExport: true,
        media: [{ id: "66666666-6666-4666-8666-666666666666", kind: "file", title: "Ficha", assetId, alt: "Ficha", caption: "" }],
        createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      }],
      assets: [{
        id: assetId, unitId, name: "ficha.pdf", mimeType: "application/pdf", alt: "Ficha",
        createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
      }]
    }));
    zip.file(`assets/${assetId}-ficha.pdf`, new Uint8Array([37, 80, 68, 70]));
    const importedId = await importUnitPackage(new File([await zip.generateAsync({ type: "uint8array" })], "medios.udpack"), projectId);
    const importedSession = await db.sessions.where("unitId").equals(importedId).first();
    const importedActivity = await db.activities.where("sessionId").equals(importedSession!.id).first();
    const importedAsset = await db.assets.get(importedActivity!.media[0].assetId!);
    expect(importedAsset?.name).toBe("ficha.pdf");
    expect(importedActivity?.media[0].assetId).not.toBe(assetId);
  });
});
