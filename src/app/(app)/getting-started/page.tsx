"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Compass, Play, Sparkles, MessageCircle, Users, Building2, Globe, UserPlus, KanbanSquare, Megaphone } from "lucide-react";
import { api } from "@/lib/client";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { cn, formatPhone } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlay";

type WsResp = { progress: Record<string, boolean>; connectedPhone: string | null };

const STEP_ICONS = [MessageCircle, Building2, Users, UserPlus, Globe];
const STEP_CTA: Record<string, string> = { whatsapp: "Conectar WhatsApp", catalog: "Cadastrar imóvel", team: "Convidar equipe", contact: "Criar contato", seoScript: "Instalar script" };

const TOUR = [
  { icon: MessageCircle, title: "Atendimento", text: "Todas as conversas do WhatsApp da empresa e dos corretores em uma caixa de entrada só. O gestor audita tudo; o corretor vê só as dele.", href: "/atendimento" },
  { icon: Sparkles, title: "Téo ✨", text: "A IA responde o lead na hora, faz as perguntas de qualificação (renda, entrada, FGTS…) e entrega para o corretor certo pela roleta.", href: "/teo/automacoes" },
  { icon: KanbanSquare, title: "Funis", text: "Kanban com arrastar-e-soltar e uma visão de análise com ranking de corretores e conversão por etapa.", href: "/funis" },
  { icon: Megaphone, title: "Campanhas", text: "Disparos com modelos oficiais da Meta, segmentados por etapa do funil, com custo calculado antes de enviar.", href: "/campanhas" },
  { icon: Globe, title: "Site & SEO", text: "Um script no site mostra qual página do Google gerou cada conversa no WhatsApp — e quanto ela vendeu.", href: "/site-seo" },
];

function TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  const s = TOUR[i];
  const Icon = s.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Passeio pelo sistema" description={`Passo ${i + 1} de ${TOUR.length}`}>
        <div className="px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white"><Icon className="h-7 w-7" /></div>
          <h3 className="text-lg font-semibold">{s.title}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{s.text}</p>
          <div className="mt-5 flex justify-center gap-1.5">{TOUR.map((_, k) => <span key={k} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-primary" : "w-1.5 bg-slate-300")} />)}</div>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft /> Anterior</Button>
          <Button variant="outline" size="sm" asChild><Link href={s.href}>Abrir {s.title}</Link></Button>
          {i < TOUR.length - 1 ? <Button size="sm" onClick={() => setI(i + 1)}>Próximo <ChevronRight /></Button> : <Button size="sm" onClick={() => onOpenChange(false)}>Concluir</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const url = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL;
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (!open || url) return;
    setSlide(0);
    const t = setInterval(() => setSlide((s) => (s + 1) % TOUR.length), 4000);
    return () => clearInterval(t);
  }, [open, url]);
  const s = TOUR[slide];
  const Icon = s.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Vídeo de boas-vindas" description="2 minutos para entender como tudo se conecta">
        {url ? (
          <video src={url} controls autoPlay className="aspect-video w-full bg-black" />
        ) : (
          <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-primary to-secondary text-white">
            <Icon key={slide} className="mb-4 h-14 w-14 animate-fade-in" />
            <p key={`t${slide}`} className="animate-fade-in text-2xl font-semibold">{s.title}</p>
            <p key={`d${slide}`} className="mt-2 max-w-lg animate-fade-in px-6 text-center text-sm text-white/80">{s.text}</p>
            <div className="absolute bottom-0 left-0 h-1 bg-white/70 transition-all duration-[4000ms] ease-linear" style={{ width: `${((slide + 1) / TOUR.length) * 100}%` }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GettingStarted() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const { data: me } = useMe();
  const { data } = useQuery({ queryKey: ["workspace"], queryFn: () => api<WsResp>("/api/workspace") });
  const [video, setVideo] = useState(false);
  const [tour, setTour] = useState(false);
  useEffect(() => { if (sp.get("tour")) setTour(true); }, [sp]);
  const mark = useMutation({
    mutationFn: (p: { key: string; value: boolean }) => api("/api/workspace", { method: "PATCH", body: { onboarding: { [p.key]: p.value } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });
  const progress = data?.progress ?? {};
  const done = ONBOARDING_STEPS.filter((s) => progress[s.key]).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">Primeiros passos</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Olá, {me?.workspace.name ?? "…"}. Vamos deixar a conta pronta.</h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(done / 5) * 100}%` }} />
          </div>
          <span className="whitespace-nowrap text-sm font-medium text-slate-600">{done} de 5 concluídos</span>
        </div>
      </div>

      <div className="space-y-3">
        {ONBOARDING_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const ok = !!progress[s.key];
          return (
            <Card key={s.key} className={cn("flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center", ok && "border-emerald-200 bg-emerald-50/30")}>
              <div className="flex items-center gap-4 sm:flex-1">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", ok ? "bg-success text-white" : "bg-primary/10 text-primary")}>
                  {ok ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-muted-foreground" /> {s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.key === "whatsapp" && data?.connectedPhone ? <>Conectado: <strong className="text-foreground">{formatPhone(data.connectedPhone)}</strong></> : s.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-13 sm:pl-0">
                {(!ok || s.key === "catalog") && <Button size="sm" asChild><Link href={s.href}>{STEP_CTA[s.key]}</Link></Button>}
                <button
                  onClick={() => mark.mutate({ key: s.key, value: !ok })}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors", ok ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "border bg-white text-slate-600 hover:bg-muted")}
                >
                  <Check className="h-3.5 w-3.5" /> Feito
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 flex flex-col items-center gap-5 overflow-hidden p-4 sm:flex-row">
        <button onClick={() => setVideo(true)} className="group relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-primary to-secondary sm:w-48">
          <Sparkles className="absolute left-3 top-3 h-4 w-4 text-white/60" />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-transform group-hover:scale-110"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">2:00</span>
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold">Vídeo de boas-vindas</p>
          <p className="mt-1 text-xs text-muted-foreground">Veja em 2 minutos como o {me?.assistantName ?? "Téo"} atende seus leads no WhatsApp, como o funil se organiza sozinho e como medir o retorno do SEO.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => setVideo(true)}><Play /> Assistir</Button>
            <button onClick={() => setTour(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Compass className="h-3.5 w-3.5" /> Fazer um passeio pelo sistema</button>
          </div>
        </div>
      </Card>
      <VideoDialog open={video} onOpenChange={setVideo} />
      <TourDialog open={tour} onOpenChange={setTour} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <GettingStarted />
    </Suspense>
  );
}
