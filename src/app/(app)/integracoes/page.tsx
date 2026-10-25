"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Facebook, Globe, Link2, Plus, QrCode, RefreshCw, Smartphone, Trash2, Webhook, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { cn, formatDate, formatPhone, timeAgo } from "@/lib/utils";
import type { Channel } from "@/lib/types";
import { useCan, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, Switch } from "@/components/ui/overlay";

type Integration = { id: string; type: string; name: string; isEnabled: boolean; webhookUrl: string; leadsReceived: number; lastEventAt: string | null; configJson: Record<string, unknown> };
type Tab = "oficial" | "qr" | "facebook" | "google" | "portais";

const STATUS = {
  CONNECTED: { label: "Conectado", tone: "green" as const, icon: CheckCircle2 },
  ATTENTION: { label: "Requer atenção", tone: "amber" as const, icon: AlertTriangle },
  DISCONNECTED: { label: "Desconectado", tone: "red" as const, icon: XCircle },
};

function ChannelDialog({ open, onOpenChange, provider, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; provider: "META_OFFICIAL" | "EVOLUTION_QR"; onSaved: () => void }) {
  const { data: team } = useTeam();
  const [f, setF] = useState({ name: "", phoneNumber: "", accountType: "COMPANY", userId: "", metaWabaId: "", metaPhoneNumberId: "", metaAccessToken: "", evolutionApiUrl: "", evolutionApiKey: "", evolutionInstance: "" });
  const [loading, setLoading] = useState(false);
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setLoading(true);
    try {
      await api("/api/channels", { body: { ...f, provider, userId: f.accountType === "BROKER" ? f.userId || null : null } });
      toast.success("Número adicionado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={provider === "META_OFFICIAL" ? "Conectar número — WhatsApp Cloud API (Oficial)" : "Conectar número — WhatsApp App (QR Code)"} size="md">
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome de exibição"><Input value={f.name} onChange={s("name")} placeholder="Comercial / Márcio" /></Field>
          <Field label="Número"><Input value={f.phoneNumber} onChange={s("phoneNumber")} placeholder="(75) 99800-1000" /></Field>
          <Field label="Tipo de conta"><Select value={f.accountType} onChange={s("accountType")}><option value="COMPANY">Empresa</option><option value="BROKER">Corretor</option></Select></Field>
          {f.accountType === "BROKER" && <Field label="Corretor"><Select value={f.userId} onChange={s("userId")}><option value="">Selecione…</option>{team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>}
          {provider === "META_OFFICIAL" ? (
            <>
              <Field label="WABA ID"><Input value={f.metaWabaId} onChange={s("metaWabaId")} /></Field>
              <Field label="Phone Number ID"><Input value={f.metaPhoneNumberId} onChange={s("metaPhoneNumberId")} /></Field>
              <Field label="Token de acesso permanente" className="sm:col-span-2" hint="Token de usuário do sistema com whatsapp_business_messaging e whatsapp_business_management. Use 'demo-…' para modo simulado."><Input type="password" value={f.metaAccessToken} onChange={s("metaAccessToken")} /></Field>
              <p className="rounded-md bg-slate-50 p-3 text-xs text-muted-foreground sm:col-span-2">Configure o webhook no app da Meta: <code className="break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/meta</code> com o token de verificação definido em <code>META_WEBHOOK_VERIFY_TOKEN</code> e assine o campo <strong>messages</strong>.</p>
            </>
          ) : (
            <>
              <Field label="URL da Evolution API (opcional)" hint="Vazio = usa EVOLUTION_API_URL do servidor"><Input value={f.evolutionApiUrl} onChange={s("evolutionApiUrl")} placeholder="https://evolution.suaagencia.com" /></Field>
              <Field label="API Key (opcional)"><Input type="password" value={f.evolutionApiKey} onChange={s("evolutionApiKey")} /></Field>
              <Field label="Nome da instância (opcional)" className="sm:col-span-2"><Input value={f.evolutionInstance} onChange={s("evolutionInstance")} placeholder="gerado automaticamente" /></Field>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={f.name.length < 2 || f.phoneNumber.replace(/\D/g, "").length < 10}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelsTable({ channels, onChanged, provider }: { channels: Channel[]; onChanged: () => void; provider: "META_OFFICIAL" | "EVOLUTION_QR" }) {
  const { isManager, me } = useCan();
  const [qr, setQr] = useState<{ name: string; code: string | null } | null>(null);
  const connect = useMutation({
    mutationFn: (c: Channel) => api<{ status: string; qrCode: string | null; simulated: boolean }>(`/api/channels/${c.id}/connect`, { method: "POST" }).then((r) => ({ r, c })),
    onSuccess: ({ r, c }) => {
      onChanged();
      if (r.qrCode) setQr({ name: c.name, code: r.qrCode });
      else toast.success(r.simulated ? `${c.name} conectado (modo demonstração)` : `Status: ${r.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/channels/${id}`, { method: "DELETE" }), onSuccess: onChanged });
  const list = channels.filter((c) => c.provider === provider);
  if (!list.length) return <EmptyState icon={<Smartphone className="h-5 w-5" />} title="Nenhum número" description="Adicione o número da empresa ou dos corretores." />;
  const section = (title: string, items: Channel[]) => items.length > 0 && (
    <div>
      <p className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.map((c) => {
        const st = STATUS[c.status];
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-0">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", c.status === "CONNECTED" ? "bg-emerald-50 text-emerald-600" : c.status === "ATTENTION" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}><st.icon className="h-4 w-4" /></span>
            <div className="min-w-[180px] flex-1">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{formatPhone(c.phoneNumber)}{c.user ? ` · ${c.user.name}` : ""}{c.metaPhoneNumberId ? ` · ID ${c.metaPhoneNumberId}` : ""}</p>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
            <span className="w-28 text-xs text-muted-foreground">{c.lastActivityAt ? `Ativo há ${timeAgo(c.lastActivityAt)}` : "Sem atividade"}</span>
            <span className="w-24 text-xs text-muted-foreground">{c._count?.conversations ?? 0} conversas</span>
            {(isManager || c.userId === me?.user.id) && (
              <Button size="xs" variant={c.status === "CONNECTED" ? "outline" : "default"} onClick={() => connect.mutate(c)} loading={connect.isPending && connect.variables?.id === c.id}>
                {provider === "EVOLUTION_QR" ? <><QrCode /> {c.status === "CONNECTED" ? "Reconectar" : "Gerar QR Code"}</> : <><RefreshCw /> Verificar</>}
              </Button>
            )}
            {isManager && <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Remover ${c.name}?`) && del.mutate(c.id)}><Trash2 /></Button>}
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      {section("Números da empresa", list.filter((c) => c.accountType === "COMPANY"))}
      {section("Números dos corretores", list.filter((c) => c.accountType === "BROKER"))}
      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent title={`Conectar ${qr?.name}`} description="Abra o WhatsApp no celular › Aparelhos conectados › Conectar aparelho" size="sm">
          <DialogBody className="flex justify-center py-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr?.code && <img src={qr.code.startsWith("data:") ? qr.code : `data:image/png;base64,${qr.code}`} alt="QR Code" className="h-64 w-64" />}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IntegrationsList({ items, types, onChanged }: { items: Integration[]; types: string[]; onChanged: () => void }) {
  const { isManager } = useCan();
  const { data: pipelines } = usePipelines();
  const [mapOpen, setMapOpen] = useState<Integration | null>(null);
  const [map, setMap] = useState<{ src: string; dst: string }[]>([]);
  const patch = useMutation({
    mutationFn: (p: { id: string; isEnabled?: boolean; config?: Record<string, unknown> }) => api(`/api/integrations/${p.id}`, { method: "PATCH", body: p }),
    onSuccess: () => { onChanged(); toast.success("Integração atualizada"); },
  });
  const create = useMutation({
    mutationFn: (type: string) => api("/api/integrations", { body: { type, name: prompt("Nome da integração:", type === "FACEBOOK_LEAD_ADS" ? "Formulário instantâneo" : "Nova integração") || "Integração" } }),
    onSuccess: onChanged,
  });
  const list = items.filter((i) => types.includes(i.type));
  return (
    <div className="space-y-3">
      {list.map((i) => (
        <Card key={i.id} className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.leadsReceived} leads recebidos · último {i.lastEventAt ? formatDate(i.lastEventAt, true) : "—"}</p>
            </div>
            {i.type === "FACEBOOK_LEAD_ADS" && isManager && <Button size="xs" variant="outline" onClick={() => { setMapOpen(i); setMap(Object.entries((i.configJson.fieldMap ?? {}) as Record<string, string>).map(([src, dst]) => ({ src, dst }))); }}>Mapear campos</Button>}
            <Switch disabled={!isManager} checked={i.isEnabled} onCheckedChange={(v) => patch.mutate({ id: i.id, isEnabled: v })} />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <code className="flex-1 truncate text-[11px]">{i.webhookUrl}</code>
            <Button size="xs" variant="ghost" onClick={() => { navigator.clipboard.writeText(i.webhookUrl); toast.success("URL copiada"); }}><Copy /></Button>
          </div>
        </Card>
      ))}
      {!list.length && <EmptyState icon={<Webhook className="h-5 w-5" />} title="Nenhuma integração configurada" />}
      {isManager && <Button size="sm" variant="outline" onClick={() => create.mutate(types[0])}><Plus /> Nova integração</Button>}
      <Dialog open={!!mapOpen} onOpenChange={(o) => !o && setMapOpen(null)}>
        <DialogContent title="Mapeamento do formulário instantâneo" description="Campo do Facebook → campo do contato no CRM" size="md">
          <DialogBody className="space-y-2">
            {map.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input value={m.src} onChange={(e) => setMap(map.map((x, k) => (k === i ? { ...x, src: e.target.value } : x)))} placeholder="full_name" className="font-mono text-xs" />
                <Select value={m.dst} onChange={(e) => setMap(map.map((x, k) => (k === i ? { ...x, dst: e.target.value } : x)))}>
                  {["name", "phone", "email", "monthlyIncome"].map((d) => <option key={d}>{d}</option>)}
                </Select>
                <Button size="icon" variant="ghost" onClick={() => setMap(map.filter((_, k) => k !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => setMap([...map, { src: "", dst: "name" }])}><Plus /> Campo</Button>
            <Field label="Etapa de entrada" className="pt-2">
              <Select defaultValue={String(mapOpen?.configJson.stageId ?? "")} id="fb-stage">
                {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => {
              const stageId = (document.getElementById("fb-stage") as HTMLSelectElement | null)?.value;
              const pipelineId = pipelines?.find((p) => p.stages.some((s) => s.id === stageId))?.id;
              patch.mutate({ id: mapOpen!.id, config: { fieldMap: Object.fromEntries(map.filter((m) => m.src).map((m) => [m.src, m.dst])), stageId, pipelineId } });
              setMapOpen(null);
            }}>Salvar mapeamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Integracoes() {
  const qc = useQueryClient();
  const { isManager } = useCan();
  const [tab, setTab] = useState<Tab>("oficial");
  const [add, setAdd] = useState<"META_OFFICIAL" | "EVOLUTION_QR" | null>(null);
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: () => api<Channel[]>("/api/channels") });
  const { data: integrations } = useQuery({ queryKey: ["integrations"], queryFn: () => api<Integration[]>("/api/integrations") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["channels"] }); qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["workspace"] }); };
  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "oficial", label: "WhatsApp Oficial", icon: CheckCircle2 },
    { key: "qr", label: "WhatsApp App (QR Code)", icon: QrCode },
    { key: "facebook", label: "Facebook Lead Ads", icon: Facebook },
    { key: "google", label: "Google Ads", icon: Globe },
    { key: "portais", label: "Portais / Webhooks", icon: Webhook },
  ];
  const all = channels ?? [];
  const prov = tab === "qr" ? "EVOLUTION_QR" : "META_OFFICIAL";
  const scoped = all.filter((c) => c.provider === prov);
  return (
    <div className="flex min-h-app">
      <aside className="hidden w-60 shrink-0 border-r bg-white p-3 md:block">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium", tab === t.key ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </aside>
      <div className="min-w-0 flex-1 px-4 py-6 md:px-6">
        <Select value={tab} onChange={(e) => setTab(e.target.value as Tab)} className="mb-4 md:hidden">{tabs.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
        {(tab === "oficial" || tab === "qr") && (
          <>
            <PageHeader
              title={tab === "oficial" ? "WhatsApp Oficial (Cloud API)" : "WhatsApp App (QR Code)"}
              description={tab === "oficial" ? "Números conectados à API oficial da Meta: templates aprovados, janela de 24h e disparos sem risco de bloqueio." : "Conecte o WhatsApp dos corretores pelo QR Code (Evolution API). O gestor audita todas as conversas."}
              actions={isManager && <Button size="sm" onClick={() => setAdd(prov)}><Plus /> Adicionar número</Button>}
            />
            <div className="mb-5 grid grid-cols-3 gap-3">
              <Stat label="Números" value={scoped.length} />
              <Stat label="Conectados" value={scoped.filter((c) => c.status === "CONNECTED").length} />
              <Stat label="Requerem atenção" value={scoped.filter((c) => c.status !== "CONNECTED").length} className={scoped.some((c) => c.status !== "CONNECTED") ? "border-amber-200 bg-amber-50/40" : undefined} />
            </div>
            <Card className="overflow-hidden"><ChannelsTable channels={all} provider={prov} onChanged={refresh} /></Card>
          </>
        )}
        {tab === "facebook" && (
          <>
            <PageHeader title="Facebook Lead Ads" description="Formulários instantâneos do Facebook/Instagram viram contatos na hora, com distribuição pela roleta." />
            <Card className="mb-4 p-4 text-xs text-muted-foreground">Na Meta, crie uma assinatura de webhook <strong>leadgen</strong> (ou use Zapier/Make) apontando para a URL da integração. O payload <code>field_data</code> é mapeado automaticamente.</Card>
            <IntegrationsList items={integrations ?? []} types={["FACEBOOK_LEAD_ADS"]} onChanged={refresh} />
          </>
        )}
        {tab === "google" && (
          <>
            <PageHeader title="Google Ads" description="Receba os leads dos formulários de lead do Google Ads (webhook de extensão de formulário)." />
            <Card className="mb-4 p-4 text-xs text-muted-foreground">No Google Ads › Recursos › Formulário de lead › Integração por webhook, cole a URL abaixo. Os campos <code>user_column_data</code> são lidos automaticamente.</Card>
            <IntegrationsList items={integrations ?? []} types={["GOOGLE_ADS"]} onChanged={refresh} />
          </>
        )}
        {tab === "portais" && (
          <>
            <PageHeader title="Portais Imobiliários / Webhooks" description="Grupo OLX (ZAP + Viva Real), Chaves na Mão, Imovelweb ou qualquer sistema que envie JSON." />
            <CardHeader className="mb-2 rounded-lg border bg-white" title="Formato aceito" description='POST JSON com { "name", "phone", "email", "message", "listing_id" } — ou o formato nativo de cada portal.' />
            <IntegrationsList items={integrations ?? []} types={["PORTAL_OLX", "PORTAL_CHAVES_NA_MAO", "PORTAL_IMOVELWEB", "CUSTOM_WEBHOOK"]} onChanged={refresh} />
          </>
        )}
      </div>
      {add && <ChannelDialog open={!!add} onOpenChange={(o) => !o && setAdd(null)} provider={add} onSaved={refresh} />}
    </div>
  );
}
