"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Compass, Play, Sparkles, MessageCircle, Users, Building2, Globe, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { cn, formatPhone } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { ALL_NAV } from "@/components/layout/nav-config";

type WsResp = { progress: Record<string, boolean>; connectedPhone: string | null };

const STEP_ICONS = [MessageCircle, Building2, Users, UserPlus, Globe];
const STEP_CTA: Record<string, string> = { whatsapp: "Conectar WhatsApp", catalog: "Cadastrar imóvel", team: "Convidar equipe", contact: "Criar contato", seoScript: "Instalar script" };

const TOUR_TEXT: Record<string, string> = {
  "/atendimento": "Todas as conversas do WhatsApp da empresa e dos corretores numa caixa de entrada só. O gestor audita tudo; o corretor vê só as dele.",
  "/ia/automacoes": "A IA responde o lead na hora, faz as perguntas de qualificação (renda, entrada, FGTS…) e entrega para o corretor certo pela roleta.",
};
/** O tour passa por todos os módulos do mapa da plataforma. */
const TOUR = ALL_NAV.filter((n) => n.inMap && !n.roles).map((n) => ({ icon: n.icon, title: n.ai ? "Copiloto" : n.label, text: TOUR_TEXT[n.href] ?? n.description, href: n.href }));

function TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  const s = TOUR[i];
  const Icon = s.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Tour pelo Ápice" description={`Passo ${i + 1} de ${TOUR.length}`}>
        <div className="px-6 py-8 text-center">
          <div key={i} className="mx-auto mb-4 flex h-16 w-16 animate-rise items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-primary text-primary-foreground shadow-xl shadow-primary/30"><Icon className="h-8 w-8" /></div>
          <h3 key={`t${i}`} className="display animate-rise text-2xl">{s.title}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{s.text}</p>
          <div className="mt-5 flex justify-center gap-1.5">{TOUR.map((_, k) => <span key={k} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-primary" : "w-1.5 bg-border")} />)}</div>
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
          <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-[#0B0F19] bg-[radial-gradient(120%_120%_at_100%_0%,rgb(var(--brand)/0.35),transparent_60%)] text-white">
            <Icon key={slide} className="mb-4 h-14 w-14 animate-fade-in" />
            <p key={`t${slide}`} className="display animate-fade-in text-3xl text-gold">{s.title}</p>
            <p key={`d${slide}`} className="mt-2 max-w-lg animate-fade-in px-6 text-center text-sm text-white/80">{s.text}</p>
            <div className="absolute bottom-0 left-0 h-1 bg-card/70 transition-all ease-linear" style={{ width: `${((slide + 1) / TOUR.length) * 100}%`, transitionDuration: "4000ms" }} />
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
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <div className="mb-8 animate-rise">
        <p className="eyebrow">Primeiros passos</p>
        <h1 className="display mt-1 text-[32px] leading-tight sm:text-[40px]">Vamos deixar a <span className="text-gradient">{me?.workspace.name ?? "conta"}</span> pronta.</h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${(done / 5) * 100}%` }} />
          </div>
          <span className="whitespace-nowrap text-sm font-extrabold text-foreground/75">{done} de 5 concluídos</span>
        </div>
      </div>

      <div className="space-y-3">
        {ONBOARDING_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const ok = !!progress[s.key];
          return (
            <Card key={s.key} style={{ animationDelay: `${i * 50}ms` }} className={cn("card-hover flex animate-rise flex-col gap-4 p-5 sm:flex-row sm:items-center", ok && "border-emerald-200")}>
              <div className="flex items-center gap-4 sm:flex-1">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-lg font-semibold", ok ? "bg-success text-white" : "border border-primary/25 bg-primary/10 text-primary dark:text-secondary")}>
                  {ok ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-extrabold"><Icon className="h-4 w-4 text-muted-foreground" /> {s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.key === "whatsapp" && data?.connectedPhone ? <>Conectado: <strong className="text-foreground">{formatPhone(data.connectedPhone)}</strong></> : s.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-13 sm:pl-0">
                {(!ok || s.key === "catalog") && <Button size="sm" asChild><Link href={s.href}>{STEP_CTA[s.key]}</Link></Button>}
                <button
                  onClick={() => mark.mutate({ key: s.key, value: !ok })}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors", ok ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "border bg-card text-foreground/75 hover:bg-muted")}
                >
                  <Check className="h-3.5 w-3.5" /> Feito
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 flex flex-col items-center gap-5 overflow-hidden p-4 sm:flex-row">
        <button onClick={() => setVideo(true)} className="group relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0B0F19] bg-[radial-gradient(120%_120%_at_100%_0%,rgb(var(--brand)/0.4),transparent_60%)] sm:w-48">
          <Sparkles className="absolute left-3 top-3 h-4 w-4 text-white/60" />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-primary shadow-lg transition-transform group-hover:scale-110"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">2:00</span>
        </button>
        <div className="flex-1">
          <p className="text-[15px] font-extrabold">Vídeo de boas-vindas</p>
          <p className="mt-1 text-xs text-muted-foreground">Veja em 2 minutos como a {me?.assistantName ?? "Zeni"} atende seus leads no WhatsApp, como o funil se organiza sozinho e como medir o retorno do SEO.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => setVideo(true)}><Play /> Assistir</Button>
            <button onClick={() => setTour(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Compass className="h-3.5 w-3.5" /> Fazer o tour pelo Ápice</button>
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
