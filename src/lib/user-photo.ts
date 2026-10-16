import { readFile } from "fs/promises";
import path from "path";

function photosDirs(): string[] {
  const root = process.cwd();
  return [path.join(root, "data", "user-photos"), path.join(root, "data")];
}

function mimeFromPhotoName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function readUserPhotoFile(
  userId: string,
  photoName?: string
): Promise<{ bytes: Buffer; mime: string; fileName: string } | null> {
  const id = String(userId || "").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  const preferred = path.basename(String(photoName || "").trim());
  const tryNames = [
    preferred,
    `${id}.jpg`,
    `${id}.jpeg`,
    `${id}.png`,
    `${id}.webp`,
  ].filter(Boolean);
  const seen = new Set<string>();
  for (const dir of photosDirs()) {
    for (const fileName of tryNames) {
      if (seen.has(`${dir}:${fileName}`)) continue;
      seen.add(`${dir}:${fileName}`);
      try {
        const bytes = await readFile(path.join(dir, fileName));
        return { bytes, mime: mimeFromPhotoName(fileName), fileName };
      } catch {
        /* next */
      }
    }
  }
  return null;
}
