import { Check, CheckCheck, FileText, Megaphone, AlertCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

function Ticks({ status }: { status: Message["status"] }) {
  if (status === "FAILED") return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  if (status === "READ") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  if (status === "DELIVERED") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/80" />;
  return <Check className="h-3.5 w-3.5 text-muted-foreground/80" />;
}

export function MessageBubble({ m, assistantName }: { m: Message; assistantName: string }) {
  const inbound = m.senderType === "CONTACT";
  const ai = m.senderType === "AI_AGENT";
  const system = m.senderType === "SYSTEM";
  const time = new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  // remove o protocolo do tracker do texto exibido, mas mostra um selo
  const ref = m.content.match(/\[\s*Ref:?\s*#?([A-Z]{2,4}-[A-Z0-9]{4,8})\s*\]/i)?.[1];
  const text = ref ? m.content.replace(/\n*\[\s*Ref:?[^\]]*\]/i, "").trim() : m.content;
  const aiLabel = ai ? (m.senderName?.replace(/^IA:\s*/, "") || assistantName) : null;

  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "relative max-w-[78%] animate-rise rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          inbound ? "rounded-tl-md border bg-card text-foreground/90" : "rounded-tr-md",
          !inbound && !system && (ai ? "bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30" : "bg-primary text-primary-foreground"),
          system && "bg-amber-50 ring-1 ring-amber-200/70",
        )}
      >
        {ai && (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-extrabold text-primary dark:text-secondary">
            ✦ {aiLabel} · IA
          </p>
        )}
        {!inbound && !ai && !system && m.senderName && <p className="mb-0.5 text-[11px] font-extrabold opacity-80">{m.senderName}</p>}
        {system && (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            {m.mediaType === "TEMPLATE" ? <Megaphone className="h-3.5 w-3.5" /> : null} {m.senderName ?? "Sistema"} {m.mediaType === "TEMPLATE" && "· Modelo Meta"}
          </p>
        )}
        {m.mediaType === "TEMPLATE" && !system && <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-700"><Megaphone className="h-3.5 w-3.5" /> Modelo aprovado (Meta)</p>}
        {m.mediaUrl && m.mediaType === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.mediaUrl} alt="" className="mb-1.5 max-h-64 rounded-lg object-cover" />
        )}
        {m.mediaUrl && m.mediaType === "AUDIO" && <audio src={m.mediaUrl} controls className="mb-1 h-9 w-60" />}
        {m.mediaUrl && m.mediaType === "DOCUMENT" && (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-md bg-card/70 px-2 py-1.5 text-xs text-primary ring-1 ring-border">
            <FileText className="h-4 w-4" /> Abrir documento
          </a>
        )}
        {m.mediaType === "AUDIO" && !m.mediaUrl && <Mic className="mb-1 inline h-3.5 w-3.5 text-muted-foreground" />}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
        <div className={cn("mt-1 flex items-center justify-end gap-1.5 text-[10px]", !inbound && !ai && !system ? "opacity-70" : "text-muted-foreground/80")}>
          {ref && <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">🔗 #{ref}</span>}
          {time}
          {!inbound && <Ticks status={m.status} />}
        </div>
      </div>
    </div>
  );
}
