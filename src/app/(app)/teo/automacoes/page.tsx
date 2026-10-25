"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CalendarHeart, ClipboardCheck, MessageCircle, RefreshCw, Settings2, UserCheck } from "lucide-react";
import { api } from "@/lib/client";
import { formatPhone } from "@/lib/utils";
import { useCan } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, Switch } from "@/components/ui/overlay";
import { TeoConfigDrawer } from "@/components/teo/config-drawer";

type Item = {
  type: string; name: string; description: string; isEnabled: boolean; configured: boolean; usage: string;
  config: Record<string, unknown>; channels: { id: string; name: string; phoneNumber: string }[];
};
type Resp = { assistantName: string; items: Item[]; channels: { id: string; name: string; phoneNumber: string; status: string }[] };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  WHATSAPP_QUALIFICATION: MessageCircle,
  VISIT_REMINDER: Bell,
  BROKER_FOLLOWUP: UserCheck,
  POST_VISIT: ClipboardCheck,
  LEAD_REENGAGEMENT: RefreshCw,
  ANNUAL_DATES: CalendarHeart,
};

const FIELDS: Record<string, { key: string; label: string; suffix: string; def: number }[]> = {
  VISIT_REMINDER: [{ key: "hoursBefore", label: "Enviar lembrete com antecedência de", suffix: "horas", def: 24 }],
  BROKER_FOLLOWUP: [{ key: "minutesWithoutReply", label: "Cobrar o corretor após", suffix: "minutos sem resposta", def: 30 }],
  POST_VISIT: [{ key: "hoursAfter", label: "Perguntar ao cliente após", suffix: "horas da visita", def: 24 }],
  LEAD_REENGAGEMENT: [{ key: "inactiveDays", label: "Retomar leads parados há", suffix: "dias", def: 15 }],
  ANNUAL_DATES: [],
};

function RuleDialog({ item, channels, onClose }: { item: Item | null; channels: Resp["channels"]; onClose: () => void }) {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Record<string, unknown>>({});
  const [lastType, setLastType] = useState<string | null>(null);
  if (item && item.type !== lastType) {
    setLastType(item.type);
    setCfg(item.config);
  }
  const save = useMutation({
    mutationFn: () => api("/api/teo/automations", { method: "PATCH", body: { type: item!.type, config: cfg, isEnabled: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teo-automations"] }); toast.success("Automação configurada e ligada"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Configurar: ${item?.name}`} description={item?.description} size="sm">
        <DialogBody className="space-y-3">
          {(FIELDS[item?.type ?? ""] ?? []).map((f) => (
            <Field key={f.key} label={f.label}>
              <div className="flex items-center gap-2">
                <Input type="number" className="w-24" value={String(cfg[f.key] ?? f.def)} onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })} />
                <span className="text-sm text-muted-foreground">{f.suffix}</span>
              </div>
            </Field>
          ))}
          <Field label="Número vinculado">
            <Select value={String(cfg.channelId ?? "")} onChange={(e) => setCfg({ ...cfg, channelId: e.target.value })}>
              <option value="">Número da conversa mais recente</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatPhone(c.phoneNumber)}</option>)}
            </Select>
          </Field>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Na API Oficial, mensagens livres só saem com a janela de 24h aberta. Fora dela, o Téo registra a pendência na ficha e avisa o corretor.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>Salvar e ligar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Automacoes() {
  const qc = useQueryClient();
  const { isManager } = useCan();
  const [drawer, setDrawer] = useState(false);
  const [rule, setRule] = useState<Item | null>(null);
  const { data } = useQuery({ queryKey: ["teo-automations"], queryFn: () => api<Resp>("/api/teo/automations") });
  const toggle = useMutation({
    mutationFn: (p: { type: string; isEnabled: boolean }) => api("/api/teo/automations", { method: "PATCH", body: p }),
    onSuccess: (_d, p) => { qc.invalidateQueries({ queryKey: ["teo-automations"] }); toast.success(p.isEnabled ? "Automação ligada" : "Automação desligada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={`Automações do ${data?.assistantName ?? "Téo"}`} description="Tarefas que o assistente executa sozinho, 24 horas por dia." />
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[2.2fr_1.3fr_0.9fr_0.9fr_auto] gap-4 border-b bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Automação</span><span>Número vinculado</span><span>Situação</span><span>Em uso</span><span className="w-40 text-right">Ações</span>
        </div>
        {data?.items.map((i) => {
          const Icon = ICONS[i.type] ?? Settings2;
          return (
            <div key={i.type} className="grid grid-cols-1 items-center gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[2.2fr_1.3fr_0.9fr_0.9fr_auto] md:gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-semibold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.description}</p>
                </div>
              </div>
              <div className="text-xs">
                {i.channels.length ? i.channels.map((c) => <p key={c.id} className="truncate">{c.name} <span className="text-muted-foreground">{formatPhone(c.phoneNumber)}</span></p>) : <span className="text-muted-foreground">Todos os números</span>}
              </div>
              <div>{i.configured || i.isEnabled ? <Badge tone="green">Ativo</Badge> : <Badge tone="slate">Não configurado</Badge>}</div>
              <div className="text-xs text-muted-foreground">{i.usage}</div>
              <div className="flex w-40 items-center justify-end gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Switch disabled={!isManager} checked={i.isEnabled} onCheckedChange={(v) => toggle.mutate({ type: i.type, isEnabled: v })} />
                  {i.isEnabled ? "Ligado" : "Desligado"}
                </span>
                <Button size="xs" variant="outline" disabled={!isManager} onClick={() => (i.type === "WHATSAPP_QUALIFICATION" ? setDrawer(true) : setRule(i))}>Configurar</Button>
              </div>
            </div>
          );
        })}
      </Card>
      <TeoConfigDrawer open={drawer} onOpenChange={setDrawer} />
      <RuleDialog item={rule} channels={data?.channels ?? []} onClose={() => setRule(null)} />
    </div>
  );
}
