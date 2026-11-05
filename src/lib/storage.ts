// Armazenamento de arquivos enviados no chat.
// Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou a chave anon com política de upload no bucket), usa o Supabase Storage (permanente e com link público,
// exigido pela Meta/Evolution para enviar mídia). Sem eles, grava em disco local (some a cada deploy no Render).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "apice-uploads";
const LOCAL_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function storageMode() {
  return supabase() ? "supabase" : "local";
}

let bucketReady = false;
async function ensureBucket(sb: { url: string; key: string }) {
  if (bucketReady) return;
  const r = await fetch(`${sb.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sb.key}`, apikey: sb.key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 25 * 1024 * 1024 }),
  });
  // 200 = criado; 400/409 = já existe; 401/403 = chave sem permissão de criar (bucket criado no painel)
  if (!r.ok && ![400, 401, 403, 409].includes(r.status)) throw new Error(`Supabase Storage: não foi possível criar o bucket (${r.status})`);
  bucketReady = true;
}

function safeName(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  return `${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(12).toString("hex")}${ext}`;
}

/** Salva o arquivo e devolve a URL pública. */
export async function saveUpload(workspaceId: string, file: { name: string; type: string; bytes: Buffer }, appUrl: string): Promise<string> {
  const key = `${workspaceId}/${safeName(file.name)}`;
  const sb = supabase();
  if (sb) {
    await ensureBucket(sb);
    const r = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, apikey: sb.key, "Content-Type": file.type || "application/octet-stream" },
      body: new Uint8Array(file.bytes),
    });
    if (!r.ok) throw new Error(`Supabase Storage recusou o arquivo (${r.status}): ${(await r.text()).slice(0, 200)}`);
    return `${sb.url}/storage/v1/object/public/${BUCKET}/${key}`;
  }
  const full = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, file.bytes);
  return `${appUrl}/api/uploads/${key}`;
}

/** Lê um arquivo do disco local (modo sem Supabase). */
export async function readLocalUpload(parts: string[]) {
  const rel = parts.join("/");
  if (rel.includes("..")) return null;
  const full = path.join(LOCAL_DIR, rel);
  if (!full.startsWith(LOCAL_DIR)) return null;
  return readFile(full).catch(() => null);
}
