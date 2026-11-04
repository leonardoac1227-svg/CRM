"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, CheckCircle2, Facebook, Globe, MessageCircle, Plug, QrCode, RefreshCw, Settings2, ShieldCheck, Smartphone, Trash2, Webhook, XCircle, Zap } from "lucide-react";
import { api } from "@/lib/client";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import type { Channel } from "@/lib/types";
import { useCan } from "@/hooks/use-me";
import { useChannelSetup } from "@/hooks/use-channel-setup";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { MetaWizard } from "@/components/integrations/meta-wizard";
import { QrWizard } from "@/components/integrations/qr-wizard";
import { LeadSources, type Integration } from "@/components/integrations/lead-sources";

type Tab = "whatsapp" | "facebook" | "google" | "portais";

const STATUS = {
  CONNECTED: { label: "Conectado", tone: "green" as const, icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-600" },
  ATTENTION: { label: "Requer atenção", tone: "amber" as const, icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-600" },
  DISCONNECTED: { label: "Desconectado", tone: "red" as const, icon: XCircle, cls: "bg-red-500/15 text-red-600" },
};

function ChoiceCard({ icon, title, badge, points, cta, onClick, disabled }: { icon: React.ReactNode; title: string; badge: string; points: string[]; cta: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Card className="card-hover flex flex-col p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
        <div>
          <p className="text-[17px] font-extrabold">{title}</p>
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-primary dark:text-secondary">{badge}</span>
        </div>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-[13.5px] text-foreground/85"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p}</li>
        ))}
      </ul>
      <Button className="mt-5" onClick={onClick} disabled={disabled}>{cta}</Button>
    </Card>
  );
}

function ChannelRow({ c, onReconnect, onChanged }: { c: Channel; onReconnect: (c: Channel) => void; onChanged: () => void }) {
  const { isManager, me } = useCan();
  const st = STATUS[c.status];
  const verify = useMutation({
    mutationFn: () => api<{ status: string }>(`/api/channels/${c.id}/connect`, { method: "POST" }),
    onSuccess: () => { onChanged(); toast.success("Conexão verificada com a Meta"); },
    onError: (e: Error) => { onChanged(); toast.error(e.message, { duration: 8000 }); },
  });
  const del = useMutation({ mutationFn: () => api(`/api/channels/${c.id}`, { method: "DELETE" }), onSuccess: () => { onChanged(); toast.success("Número removido"); } });
  const mine = isManager || c.userId === me?.user.id;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 last:border-0">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", st.cls)}><st.icon className="h-5 w-5" /></span>
      <div className="min-w-[200px] flex-1">
        <p className="flex items-center gap-2 text-[14px] font-extrabold">
          {c.name}
          {c.provider === "META_OFFICIAL" ? <Badge tone="primary"><ShieldCheck className="h-3 w-3" /> Oficial</Badge> : <Badge tone="slate"><QrCode className="h-3 w-3" /> QR Code</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatPhone(c.phoneNumber)}
          {c.metaVerifiedName ? ` · ${c.metaVerifiedName}` : ""}
          {c.user ? ` · ${c.user.name}` : ""}
          {" · "}
          {c.lastActivityAt ? `última atividade há ${timeAgo(c.lastActivityAt)}` : "sem atividade ainda"} · {c._count?.conversations ?? 0} conversas
        </p>
      </div>
      <Badge tone={st.tone}>{st.label}</Badge>
      {mine && c.provider === "EVOLUTION_QR" && (
        <Button size="sm" variant={c.status === "CONNECTED" ? "outline" : "default"} onClick={() => onReconnect(c)}>
          <QrCode /> {c.status === "CONNECTED" ? "Reconectar" : "Conectar com QR Code"}
        </Button>
      )}
      {isManager && c.provider === "META_OFFICIAL" && (
        <>
          <Button size="sm" variant="outline" onClick={() => verify.mutate()} loading={verify.isPending}><RefreshCw /> Testar conexão</Button>
          <Button size="sm" variant="ghost" onClick={() => onReconnect(c)}><Settings2 /> Webhook</Button>
        </>
      )}
      {mine && <Button size="icon-sm" variant="ghost" aria-label="Remover número" onClick={() => confirm(`Remover ${c.name}? As conversas continuam salvas, mas novas mensagens deixam de chegar.`) && del.mutate()}><Trash2 /></Button>}
    </div>
  );
}

export default function Integracoes() {
  const qc = useQueryClient();
  const { isManager, isBroker } = useCan();
  const { data: setup } = useChannelSetup();
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [meta, setMeta] = useState<{ open: boolean; channel?: Channel | null }>({ open: false });
  const [qr, setQr] = useState<{ open: boolean; channel?: Channel | null }>({ open: false });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: () => api<Channel[]>("/api/channels"), refetchInterval: 20_000 });
  const { data: integrations } = useQuery({ queryKey: ["integrations"], queryFn: () => api<Integration[]>("/api/integrations"), enabled: !isBroker });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["channels"] }); qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["workspace"] }); };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    ...(!isBroker
      ? [
          { key: "facebook" as Tab, label: "Facebook / Instagram", icon: Facebook },
          { key: "google" as Tab, label: "Google Ads", icon: Globe },
          { key: "portais" as Tab, label: "Portais e outros", icon: Webhook },
        ]
      : []),
  ];
  const all = channels ?? [];
  const official = all.filter((c) => c.provider === "META_OFFICIAL");
  const qrs = all.filter((c) => c.provider === "EVOLUTION_QR");

  return (
    <div className="min-h-app">
      <div className="sticky top-[var(--topbar-h)] z-20 border-b bg-background/85 px-4 backdrop-blur-xl md:px-8">
        <nav aria-label="Tipos de integração" className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto py-2.5 scrollbar-thin">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined} className={cn("flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-bold transition-colors", tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:border-primary/50 hover:text-foreground")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto min-w-0 max-w-[1400px] px-4 py-6 md:px-8">
        {tab === "whatsapp" && (
          <>
            <PageHeader eyebrow="Integrações" icon={<Plug />} title="WhatsApp" description="Conecte o número da empresa e o celular dos corretores. Todas as conversas caem no Atendimento e a Zeni atende na hora." />

            {setup && !setup.publicUrlOk && (
              <Card className="mb-5 border-amber-200 bg-amber-500/10 p-4 text-sm">
                <strong>Atenção:</strong> o Ápice está rodando em {setup.appUrl}. O WhatsApp só consegue entregar mensagens para um endereço público — conecte os números no sistema publicado.
              </Card>
            )}

            <div className="mb-8 grid gap-4 lg:grid-cols-2">
              {isManager && (
                <ChoiceCard
                  icon={<BadgeCheck />}
                  title="WhatsApp oficial da Meta"
                  badge="Recomendado para a empresa"
                  points={["Sem risco de bloqueio do número", "Campanhas e lembretes com modelos aprovados", "Funciona 24h, sem celular ligado", "Passo a passo guiado de uns 20 minutos"]}
                  cta="Conectar o número oficial"
                  onClick={() => setMeta({ open: true })}
                />
              )}
              <ChoiceCard
                icon={<Smartphone />}
                title="WhatsApp pelo QR Code"
                badge={isManager ? "Ideal para corretores" : "Conecte o seu celular"}
                points={["Usa o WhatsApp que já está no celular", "Conecta em 1 minuto, como o WhatsApp Web", "O gestor acompanha as conversas", "Evite disparos em massa por aqui"]}
                cta={isManager ? "Conectar um celular" : "Conectar o meu WhatsApp"}
                onClick={() => setQr({ open: true })}
              />
            </div>

            <div className="space-y-4">
              <Card>
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="font-extrabold">Números conectados</p>
                    <p className="text-xs text-muted-foreground">{all.length ? `${all.filter((c) => c.status === "CONNECTED").length} de ${all.length} funcionando agora` : "Nenhum número ainda — escolha uma das opções acima."}</p>
                  </div>
                  <Zap className="h-5 w-5 text-primary dark:text-secondary" />
                </div>
                {[...official, ...qrs].map((c) => (
                  <ChannelRow key={c.id} c={c} onChanged={refresh} onReconnect={(ch) => (ch.provider === "META_OFFICIAL" ? setMeta({ open: true, channel: ch }) : setQr({ open: true, channel: ch }))} />
                ))}
                {!all.length && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Quando você conectar um número, ele aparece aqui com o status em tempo real.</p>}
              </Card>
            </div>
          </>
        )}

        {tab === "facebook" && (
          <>
            <PageHeader eyebrow="Integrações" icon={<Facebook />} title="Facebook e Instagram" description="Leads dos formulários dos seus anúncios entram no Ápice na hora, com origem e roleta." />
            <LeadSources kind="facebook" items={integrations ?? []} onChanged={refresh} />
          </>
        )}
        {tab === "google" && (
          <>
            <PageHeader eyebrow="Integrações" icon={<Globe />} title="Google Ads" description="Receba os contatos dos formulários de lead do Google Ads automaticamente." />
            <LeadSources kind="google" items={integrations ?? []} onChanged={refresh} />
          </>
        )}
        {tab === "portais" && (
          <>
            <PageHeader eyebrow="Integrações" icon={<Webhook />} title="Portais e outros sistemas" description="Grupo OLX (ZAP + Viva Real), Chaves na Mão, Imovelweb ou qualquer sistema que envie leads." />
            <LeadSources kind="portais" items={integrations ?? []} onChanged={refresh} />
          </>
        )}
      </div>

      <MetaWizard open={meta.open} channel={meta.channel} onOpenChange={(o) => { setMeta({ open: o }); if (!o) refresh(); }} />
      <QrWizard open={qr.open} channel={qr.channel} onOpenChange={(o) => { setQr({ open: o }); if (!o) refresh(); }} />
    </div>
  );
}
