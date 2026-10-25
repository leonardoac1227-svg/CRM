import { ExternalLink, Phone, Reply, Image as ImageIcon, FileText, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export function WhatsAppPreview({
  headerType, headerContent, body, footer, buttons, businessName = "Sua empresa", className,
}: {
  headerType: string;
  headerContent?: string | null;
  body: string;
  footer?: string | null;
  buttons?: { type: string; text: string }[];
  businessName?: string;
  className?: string;
}) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-[#efeae2] shadow-inner", className)}>
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">{businessName[0]}</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{businessName}</p>
          <p className="text-[10px] text-white/70">Conta comercial</p>
        </div>
      </div>
      <div className="min-h-[260px] space-y-1 p-3" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
        <div className="max-w-[88%] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
          {headerType === "TEXT" && headerContent && <p className="px-3 pt-2 text-sm font-bold">{headerContent}</p>}
          {headerType === "IMAGE" && (headerContent ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerContent} alt="" className="h-36 w-full object-cover" />
          ) : <div className="flex h-32 items-center justify-center bg-slate-200 text-slate-400"><ImageIcon className="h-8 w-8" /></div>)}
          {headerType === "VIDEO" && <div className="flex h-32 items-center justify-center bg-slate-800 text-white/70"><Video className="h-8 w-8" /></div>}
          {headerType === "DOCUMENT" && <div className="flex items-center gap-2 bg-slate-100 px-3 py-3 text-xs text-slate-600"><FileText className="h-5 w-5" /> documento.pdf</div>}
          <p className="whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-snug text-slate-800">{body || <span className="text-slate-400">O corpo da mensagem aparece aqui…</span>}</p>
          {footer && <p className="px-3 pb-1 text-[11px] text-slate-500">{footer}</p>}
          <p className="px-3 pb-1.5 text-right text-[10px] text-slate-400">{time}</p>
          {!!buttons?.length && (
            <div className="divide-y border-t">
              {buttons.map((b, i) => (
                <p key={i} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#00a5f4]">
                  {b.type === "URL" ? <ExternalLink className="h-3.5 w-3.5" /> : b.type === "PHONE_NUMBER" ? <Phone className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
                  {b.text || "Botão"}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
