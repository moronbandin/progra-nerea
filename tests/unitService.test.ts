import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db/database";
import { createUnit, updateSection, updateUnit } from "../src/features/units/unitService";

const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const timestamp = "2026-06-23T09:00:00.000Z";

describe("sincronización de la unidad", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.projects.add({
      id: projectId, name: "Prueba", author: "Nerea", academicYear: "2026/2027",
      createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
    });
  });

  it("crea una sola sesión inicial", async () => {
    const unit = await createUnit(projectId);
    expect(await db.sessions.where("unitId").equals(unit.id).count()).toBe(1);
  });

  it("refresca automáticamente los apartados generados", async () => {
    const unit = await createUnit(projectId);
    const introduction = await db.unitSections.where("[unitId+key]").equals([unit.id, "introduction"]).first();
    await updateUnit(unit.id, { title: "Título actualizado" });
    const updated = await db.unitSections.get(introduction!.id);
    expect(updated?.content).toContain("Título actualizado");
  });

  it("respeta los apartados editados manualmente", async () => {
    const unit = await createUnit(projectId);
    const introduction = await db.unitSections.where("[unitId+key]").equals([unit.id, "introduction"]).first();
    await updateSection(introduction!.id, { content: "<p>Texto de Nerea</p>", generated: false, manuallyEdited: true });
    await updateUnit(unit.id, { title: "Otro título" });
    expect((await db.unitSections.get(introduction!.id))?.content).toBe("<p>Texto de Nerea</p>");
  });
});
