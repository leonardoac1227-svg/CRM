"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Mic, Paperclip, Send, Smile, Square, Zap, File as FileIcon, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { cn, formatBRL } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";

const EMOJIS = "😊 😀 😂 😍 🥰 😉 🙏 👍 👏 🙌 🤝 ✅ ✨ 🎉 🏡 🏠 🔑 📍 📅 ⏰ 💰 💬 📞 📸 ❤️ 💙 🔥 ⭐ 👀 🤔 😅 😎 🚀 📄 ✍️ 🗓️".split(" ");

type QuickReply = { id: string; shortcut: string; content: string };
export type OutgoingMessage = { text: string; mediaUrl?: string; mediaType?: "IMAGE" | "AUDIO" | "DOCUMENT" };

async function upload(file: Blob, name: string) {
  const fd = new FormData();
  fd.append("file", file, name);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha no upload");
  return data as { url: string; mediaType: "IMAGE" | "AUDIO" | "DOCUMENT" };
}

export function Composer({ onSend, sending, disabled, placeholder }: { onSend: (m: OutgoingMessage) => Promise<unknown>; sending?: boolean; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelRec = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { data: quick } = useQuery({ queryKey: ["quick-replies"], queryFn: () => api<QuickReply[]>("/api/quick-replies"), staleTime: 300_000 });
  const { data: catalog } = useQuery({ queryKey: ["catalog", "composer"], queryFn: () => api<CatalogItem[]>("/api/catalog?status=AVAILABLE"), enabled: catalogOpen });

  const slash = text.startsWith("/") && !text.includes(" ") ? (quick ?? []).filter((q) => q.shortcut.startsWith(text)) : [];

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(160, ta.scrollHeight)}px`;
  }, [text]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    await onSend({ text: t }).then(() => setText("")).catch(() => undefined);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const up = await upload(f, f.name);
      await onSend({ text: text.trim() || (up.mediaType === "IMAGE" ? "📷 Imagem" : `📄 ${f.name}`), mediaUrl: up.url, mediaType: up.mediaType });
      setText("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      cancelRec.current = false;
      rec.ondataavailable = (ev) => chunks.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelRec.current) return;
        const blob = new Blob(chunks.current, { type: mime.split(";")[0] });
        try {
          const up = await upload(blob, `audio.${mime.includes("ogg") ? "ogg" : "webm"}`);
          await onSend({ text: "🎙️ Áudio", mediaUrl: up.url, mediaType: "AUDIO" });
        } catch (err) {
          toast.error((err as Error).message);
        }
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  }
  function stopRec(cancel = false) {
    cancelRec.current = cancel;
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="relative border-t bg-white px-3 py-2.5">
      {slash.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-lg border bg-white shadow-lg">
          {slash.map((q) => (
            <button key={q.id} onClick={() => setText(q.content)} className="flex w-full gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="font-mono text-xs font-semibold text-primary">{q.shortcut}</span>
              <span className="truncate text-xs text-muted-foreground">{q.content}</span>
            </button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="flex items-center gap-3">
          <button onClick={() => stopRec(true)} className="rounded-full p-2 text-slate-500 hover:bg-muted" aria-label="Cancelar"><Trash2 className="h-5 w-5" /></button>
          <span className="flex flex-1 items-center gap-2 text-sm text-red-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Gravando… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
          <Button size="icon" onClick={() => stopRec(false)} aria-label="Enviar áudio"><Square className="h-4 w-4 fill-current" /></Button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={disabled} className="rounded-full p-2 text-slate-500 hover:bg-muted disabled:opacity-40" aria-label="Anexar"><Paperclip className="h-5 w-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top">
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}><FileIcon /> Imagem ou documento</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCatalogOpen(true)}><Building2 /> Imóvel do catálogo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,audio/*" className="hidden" onChange={onFile} />
          <Popover>
            <PopoverTrigger asChild>
              <button disabled={disabled} className="rounded-full p-2 text-slate-500 hover:bg-muted disabled:opacity-40" aria-label="Respostas rápidas"><Zap className="h-5 w-5" /></button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-96 p-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Mensagens rápidas · digite / no campo</p>
              {(quick ?? []).map((q) => (
                <button key={q.id} onClick={() => setText(q.content)} className="block w-full rounded-md px-2 py-2 text-left hover:bg-muted">
                  <span className="font-mono text-xs font-semibold text-primary">{q.shortcut}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{q.content}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button disabled={disabled} className="rounded-full p-2 text-slate-500 hover:bg-muted disabled:opacity-40" aria-label="Emoji"><Smile className="h-5 w-5" /></button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-72 p-2">
              <div className="grid grid-cols-9 gap-1">
                {EMOJIS.map((e) => <button key={e} onClick={() => { setText((t) => t + e); taRef.current?.focus(); }} className="rounded p-1 text-lg hover:bg-muted">{e}</button>)}
              </div>
            </PopoverContent>
          </Popover>
          <textarea
            ref={taRef}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (slash.length === 1) setText(slash[0].content);
                else send();
              }
            }}
            rows={1}
            placeholder={placeholder ?? "Digite uma mensagem ou / para respostas rápidas"}
            className="max-h-40 min-h-[40px] flex-1 resize-none rounded-2xl border bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-white disabled:opacity-50"
          />
          {text.trim() ? (
            <Button size="icon" className="rounded-full" onClick={send} loading={sending} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          ) : (
            <Button size="icon" variant="soft" className="rounded-full" disabled={disabled} onClick={startRec} aria-label="Gravar áudio"><Mic className="h-4 w-4" /></Button>
          )}
        </div>
      )}
      {catalogOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-2 max-h-80 overflow-y-auto rounded-lg border bg-white shadow-xl scrollbar-thin">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold">Enviar imóvel do catálogo</p>
            <button onClick={() => setCatalogOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
          {(catalog ?? []).map((i) => (
            <button
              key={i.id}
              onClick={async () => {
                setCatalogOpen(false);
                await onSend({
                  text: `🏡 *${i.title}* (${i.code})\n📍 ${i.neighborhood ?? ""}${i.city ? ` – ${i.city}` : ""}\n${i.bedrooms ? `🛏️ ${i.bedrooms} quartos · ` : ""}${i.areaM2 ? `${i.areaM2} m² · ` : ""}💰 ${i.price ? formatBRL(i.price) : "Consulte"}\n\n${i.description ?? ""}`.trim(),
                  mediaUrl: i.images[0],
                  mediaType: i.images[0] ? "IMAGE" : undefined,
                });
              }}
              className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.images[0] ? <img src={i.images[0]} alt="" className="h-10 w-14 rounded object-cover" /> : <span className="h-10 w-14 rounded bg-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.title}</span>
                <span className="block text-xs text-muted-foreground">{i.code} · {i.neighborhood} · {i.price ? formatBRL(i.price) : "—"}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
