import { db } from "../../db/database";
import type { Asset } from "../../schemas/domain";
import { now, uuid } from "../../utils/ids";

export async function compressImage(file: File, maxDimension = 3200, quality = 0.92) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo comprimir.")), outputType, quality)
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

export async function saveBinaryAsset(unitId: string, file: File, alt = "", caption?: string, source?: string): Promise<Asset> {
  const timestamp = now();
  const asset: Asset = {
    id: uuid(),
    unitId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    blob: file,
    alt,
    caption,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: 1
  };
  await db.assets.add(asset);
  return asset;
}

export function externalVideoThumbnail(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId: string | undefined;
    if (host === "youtu.be") videoId = parsed.pathname.split("/").filter(Boolean)[0];
    if (host.endsWith("youtube.com")) {
      videoId = parsed.searchParams.get("v") ?? parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
    }
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined;
  } catch {
    return undefined;
  }
}

export async function createVideoThumbnail(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, Math.max(0, video.duration / 3));
      };
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("No se pudo generar la miniatura del vídeo."));
    });
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la miniatura.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo guardar la miniatura.")), "image/jpeg", 0.88)
    );
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-miniatura.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
