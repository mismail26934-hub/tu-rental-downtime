import { NextResponse } from "next/server";
import { findUserById } from "@/db/users";
import { requireUser, unauthorized } from "@/lib/http";
import { readUserPhotoFile } from "@/lib/user-photo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  try {
    const row = await findUserById(user.id);
    if (!row) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }
    const file = await readUserPhotoFile(user.id, row.photo_name);
    if (!file) {
      return NextResponse.json({ error: "Foto profil belum ada" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.length),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${file.fileName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat foto profil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
