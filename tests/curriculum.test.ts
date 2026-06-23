import { describe, expect, it } from "vitest";
import criteria from "../src/data/curriculum/assessment-criteria.json";
import blocks from "../src/data/curriculum/content-blocks.json";
import contents from "../src/data/curriculum/contents.json";
import objectives from "../src/data/curriculum/specific-competences.json";
import relationships from "../src/data/curriculum/relationships.json";
import { sectionKeys, unitSchema } from "../src/schemas/domain";

describe("currículo estructurado", () => {
  it("incluye únicamente la estructura completa de LCL 4.º ESO", () => {
    expect(objectives).toHaveLength(10);
    expect(criteria).toHaveLength(33);
    expect(blocks).toHaveLength(5);
    expect(contents.length).toBeGreaterThan(50);
  });

  it("mantiene relaciones por identificadores", () => {
    const criterionIds = new Set(criteria.map((item) => item.id));
    expect(relationships).toHaveLength(criteria.length);
    expect(relationships.every((item) => criterionIds.has(item.criterionId))).toBe(true);
    expect(relationships.every((item) => item.relationType === "normative")).toBe(true);
  });
});

describe("modelo de unidad", () => {
  it("fija doce apartados", () => {
    expect(sectionKeys).toHaveLength(12);
  });

  it("rechaza una unidad sin título", () => {
    expect(() => unitSchema.parse({})).toThrow();
  });
});
