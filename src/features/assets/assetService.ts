import { db } from "../../db/database";
import type { Asset } from "../../schemas/domain";
import { now, uuid } from "../../utils/ids";

export async function compressImage(file: File, maxDimension = 1800, quality = 0.84) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo comprimir.")), "image/jpeg", quality)
  );
  return { blob, width: canvas.width, height: canvas.height };
}

export async function saveAsset(unitId: string, file: File, alt: string, caption?: string, source?: string): Promise<Asset> {
  const image = await compressImage(file);
  const timestamp = now();
  const asset: Asset = {
    id: uuid(), unitId, name: file.name, mimeType: image.blob.type, blob: image.blob,
    width: image.width, height: image.height, alt, caption, source,
    createdAt: timestamp, updatedAt: timestamp, schemaVersion: 1
  };
  await db.assets.add(asset);
  return asset;
}
