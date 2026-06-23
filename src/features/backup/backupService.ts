import JSZip from "jszip";
import { db } from "../../db/database";
import { unitSchema, sectionSchema, sessionSchema, activitySchema, type Activity, type Asset, type Unit } from "../../schemas/domain";
import { now, uuid } from "../../utils/ids";
import { filterContentIdsByCriteria } from "../curriculum/curriculumRules";

type AssetMetadata = Omit<Asset, "blob">;

function remapActivityAssets(activity: Activity, assetMap: Map<string, string>): Activity {
  return {
    ...activity,
    media: activity.media.map((media) => ({
      ...media,
      assetId: media.assetId ? assetMap.get(media.assetId) : undefined,
      thumbnailAssetId: media.thumbnailAssetId ? assetMap.get(media.thumbnailAssetId) : undefined
    }))
  };
}

async function restoreAssets(
  zip: JSZip,
  metadata: AssetMetadata[],
  unitId: string,
  prefix = "assets/"
): Promise<{ assets: Asset[]; map: Map<string, string> }> {
  const map = new Map<string, string>();
  const restored: Asset[] = [];
  for (const source of metadata) {
    const file = zip.file(`${prefix}${source.id}-${source.name}`);
    if (!file) continue;
    const id = uuid();
    map.set(source.id, id);
    restored.push({
      ...source,
      id,
      unitId,
      blob: await file.async("blob"),
      createdAt: now(),
      updatedAt: now()
    });
  }
  return { assets: restored, map };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createPreviewPng(unit: Unit): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 848;
  const context = canvas.getContext("2d");
  if (!context) return new Blob();
  context.fillStyle = unit.color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "700 22px system-ui";
  context.fillText(`UNIDAD DIDÁCTICA ${String(unit.number).padStart(2, "0")}`, 58, 90);
  context.font = "700 54px Georgia";
  const words = unit.title.split(/\s+/);
  let line = "";
  let y = 510;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > 480 && line) {
      context.fillText(line, 58, y);
      y += 62;
      line = word;
    } else {
      line = candidate;
    }
  }
  context.fillText(line, 58, y);
  context.font = "20px system-ui";
  context.fillText("Lengua Castellana y Literatura · 4.º ESO", 58, 780);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? new Blob()), "image/png"));
}

export async function exportUnitPackage(unit: Unit) {
  const bytes = await buildUnitPackage(unit);
  const blob = new Blob([bytes], { type: "application/zip" });
  download(blob, `UD_${String(unit.number).padStart(2, "0")}_${unit.title.replace(/[^\p{L}\p{N}]+/gu, "_")}.udpack`);
}

export async function buildUnitPackage(unit: Unit): Promise<Uint8Array> {
  const [sections, sessions, assets] = await Promise.all([
    db.unitSections.where("unitId").equals(unit.id).toArray(),
    db.sessions.where("unitId").equals(unit.id).sortBy("order"),
    db.assets.where("unitId").equals(unit.id).toArray()
  ]);
  const activities = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).sortBy("order")))).flat();
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({
    format: "udpack", version: 1, exportedAt: now(), unitId: unit.id, title: unit.title
  }, null, 2));
  zip.file("unit.json", JSON.stringify({
    unit, sections, sessions, activities,
    assets: assets.map(({ blob: _blob, ...metadata }) => metadata)
  }, null, 2));
  const assetFolder = zip.folder("assets");
  assets.forEach((asset) => assetFolder?.file(`${asset.id}-${asset.name}`, asset.blob));
  zip.file("preview.png", await createPreviewPng(unit));
  return zip.generateAsync({ type: "uint8array" });
}

export async function importUnitPackage(file: File, projectId: string): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as { format: string; version: number };
  if (manifest.format !== "udpack" || manifest.version !== 1) throw new Error("Paquete incompatible.");
  const payload = JSON.parse(await zip.file("unit.json")!.async("string")) as {
    unit: unknown; sections: unknown[]; sessions: unknown[]; activities: unknown[]; assets?: AssetMetadata[];
  };
  const sourceUnit = unitSchema.parse(payload.unit);
  const unitId = uuid();
  const timestamp = now();
  const sessionMap = new Map<string, string>();
  const restored = await restoreAssets(zip, payload.assets ?? [], unitId);
  const unit = {
    ...sourceUnit,
    id: unitId,
    projectId,
    title: `${sourceUnit.title} · importada`,
    coverAssetId: sourceUnit.coverAssetId ? restored.map.get(sourceUnit.coverAssetId) : undefined,
    selectedContentIds: filterContentIdsByCriteria(sourceUnit.selectedContentIds, sourceUnit.selectedCriterionIds),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const sections = payload.sections.map((item) => ({ ...sectionSchema.parse(item), id: uuid(), unitId, createdAt: timestamp, updatedAt: timestamp }));
  const sessions = payload.sessions.map((item) => {
    const parsed = sessionSchema.parse(item);
    const id = uuid();
    sessionMap.set(parsed.id, id);
    return { ...parsed, id, unitId, createdAt: timestamp, updatedAt: timestamp };
  });
  const activities = payload.activities.map((item) => {
    const parsed = activitySchema.parse(item);
    return { ...remapActivityAssets(parsed, restored.map), id: uuid(), sessionId: sessionMap.get(parsed.sessionId)!, createdAt: timestamp, updatedAt: timestamp };
  });
  await db.transaction("rw", db.units, db.unitSections, db.sessions, db.activities, db.assets, async () => {
    await db.units.add(unit);
    await db.unitSections.bulkAdd(sections);
    await db.sessions.bulkAdd(sessions);
    await db.activities.bulkAdd(activities);
    if (restored.assets.length) await db.assets.bulkAdd(restored.assets);
  });
  return unitId;
}

export async function exportProjectPackage(projectId: string) {
  const project = await db.projects.get(projectId);
  if (!project) return;
  const units = await db.units.where("projectId").equals(projectId).toArray();
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ format: "udproject", version: 1, exportedAt: now() }, null, 2));
  const payload = [];
  for (const unit of units) {
    const sections = await db.unitSections.where("unitId").equals(unit.id).toArray();
    const sessions = await db.sessions.where("unitId").equals(unit.id).sortBy("order");
    const activities = (await Promise.all(sessions.map((session) => db.activities.where("sessionId").equals(session.id).sortBy("order")))).flat();
    const assets = await db.assets.where("unitId").equals(unit.id).toArray();
    payload.push({ unit, sections, sessions, activities, assets: assets.map(({ blob: _blob, ...metadata }) => metadata) });
    const folder = zip.folder(`assets/${unit.id}`);
    assets.forEach((asset) => folder?.file(`${asset.id}-${asset.name}`, asset.blob));
  }
  zip.file("project.json", JSON.stringify({ project, units: payload }, null, 2));
  download(await zip.generateAsync({ type: "blob" }), "programacion.udproject");
  await db.projects.update(projectId, { lastBackupAt: now(), updatedAt: now() });
}

export async function importProjectPackage(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as { format: string; version: number };
  if (manifest.format !== "udproject" || manifest.version !== 1) throw new Error("Copia de proyecto incompatible.");
  const payload = JSON.parse(await zip.file("project.json")!.async("string")) as {
    project: { name: string; author: string; academicYear: string };
    units: Array<{ unit: unknown; sections: unknown[]; sessions: unknown[]; activities: unknown[]; assets?: AssetMetadata[] }>;
  };
  const timestamp = now();
  const projectId = uuid();
  await db.projects.add({
    id: projectId,
    name: `${payload.project.name} · restaurada`,
    author: payload.project.author,
    academicYear: payload.project.academicYear,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: 1
  });
  for (const entry of payload.units) {
    const sourceUnit = unitSchema.parse(entry.unit);
    const unitId = uuid();
    const sessionMap = new Map<string, string>();
    const restored = await restoreAssets(zip, entry.assets ?? [], unitId, `assets/${sourceUnit.id}/`);
    const unit = {
      ...sourceUnit,
      id: unitId,
      projectId,
      coverAssetId: sourceUnit.coverAssetId ? restored.map.get(sourceUnit.coverAssetId) : undefined,
      selectedContentIds: filterContentIdsByCriteria(sourceUnit.selectedContentIds, sourceUnit.selectedCriterionIds),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const unitSections = entry.sections.map((item) => ({ ...sectionSchema.parse(item), id: uuid(), unitId, createdAt: timestamp, updatedAt: timestamp }));
    const unitSessions = entry.sessions.map((item) => {
      const parsed = sessionSchema.parse(item);
      const id = uuid();
      sessionMap.set(parsed.id, id);
      return { ...parsed, id, unitId, createdAt: timestamp, updatedAt: timestamp };
    });
    const unitActivities = entry.activities.map((item) => {
      const parsed = activitySchema.parse(item);
      return { ...remapActivityAssets(parsed, restored.map), id: uuid(), sessionId: sessionMap.get(parsed.sessionId)!, createdAt: timestamp, updatedAt: timestamp };
    });
    await db.transaction("rw", db.units, db.unitSections, db.sessions, db.activities, db.assets, async () => {
      await db.units.add(unit);
      await db.unitSections.bulkAdd(unitSections);
      await db.sessions.bulkAdd(unitSessions);
      await db.activities.bulkAdd(unitActivities);
      if (restored.assets.length) await db.assets.bulkAdd(restored.assets);
    });
  }
  return projectId;
}
