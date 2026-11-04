"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Plus, Settings2, Trash2, Webhook } from "lucide-react";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan, usePipelines } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, Switch } from "@/components/ui/overlay";
import { Callout, CopyField, ExtLink, Instructions, Ui } from "./wizard-kit";

export type Integration = { id: string; type: string; name: string; isEnabled: boolean; webhookUrl: string; leadsReceived: number; lastEventAt: string | null; configJson: Record<string, unknown> };

type Kind = "facebook" | "google" | "portais";
const TYPES: Record<Kind, string[]> = { facebook: ["FACEBOOK_LEAD_ADS"], google: ["GOOGLE_ADS"], portais: ["PORTAL_OLX", "PORTAL_CHAVES_NA_MAO", "PORTAL_IMOVELWEB", "CUSTOM_WEBHOOK"] };
const TYPE_LABEL: Record<string, string> = {
  FACEBOOK_LEAD_ADS: "Facebook / Instagram",
  GOOGLE_ADS: "Google Ads",
  PORTAL_OLX: "Grupo OLX (ZAP, Viva Real, OLX)",
  PORTAL_CHAVES_NA_MAO: "Chaves na Mão",
  PORTAL_IMOVELWEB: "Imovelweb",
  CUSTOM_WEBHOOK: "Outro sistema (webhook)",
};

function HowTo({ kind, url }: { kind: Kind; url: string }) {
  if (kind === "facebook")
    return (
      <div className="space-y-4">
        <p className="text-[13.5px] text-foreground/85">
          Quem preenche o formulário do seu anúncio no Facebook ou Instagram vira contato no Ápice na hora, já com a origem “Facebook Ads” e distribuído pela roleta.
          A forma mais simples é usar o <strong>Zapier</strong> (tem plano gratuito) como “ponte”.
        </p>
        <CopyField label="Endereço para onde os leads devem ser enviados (Webhook URL)" value={url} />
        <Instructions
          items={[
            <>Crie uma conta grátis no <ExtLink href="https://zapier.com/sign-up">Zapier</ExtLink> e clique em <Ui>+ Create</Ui> › <Ui>Zaps</Ui>.</>,
            <>Em <strong>Trigger</strong> (gatilho), procure <Ui>Facebook Lead Ads</Ui> e escolha o evento <Ui>New Lead</Ui>. Entre com o Facebook que administra a página e escolha a <strong>página</strong> e o <strong>formulário</strong>.</>,
            <>Em <strong>Action</strong> (ação), procure <Ui>Webhooks by Zapier</Ui> e escolha <Ui>POST</Ui>.</>,
            <>Em <strong>URL</strong>, cole o endereço acima. Em <strong>Payload Type</strong>, escolha <Ui>Json</Ui>.</>,
            <>Em <strong>Data</strong>, crie três linhas: <code>name</code> → nome completo, <code>phone</code> → telefone, <code>email</code> → e-mail (escolha os campos do formulário em cada linha).</>,
            <>Clique em <Ui>Test step</Ui>: o lead de teste aparece em Contatos. Depois clique em <Ui>Publish</Ui>.</>,
          ]}
        />
        <Callout>Prefere o <strong>Make</strong> (make.com)? O caminho é igual: módulo “Facebook Lead Ads › Watch Leads” e depois “HTTP › Make a request” com método POST, corpo JSON e o mesmo endereço.</Callout>
      </div>
    );
  if (kind === "google")
    return (
      <div className="space-y-4">
        <p className="text-[13.5px] text-foreground/85">O Google Ads envia direto para o Ápice os contatos dos <strong>formulários de lead</strong> das suas campanhas — sem ferramenta intermediária.</p>
        <CopyField label="URL do webhook" value={url} />
        <CopyField label="Chave (pode usar esta)" value={url.split("/").pop() ?? ""} />
        <Instructions
          items={[
            <>No <ExtLink href="https://ads.google.com">Google Ads</ExtLink>, abra a campanha e vá em <Ui>Recursos</Ui> (ou <Ui>Ativos</Ui>) › <Ui>Formulários de lead</Ui>.</>,
            <>Abra o formulário e role até <Ui>Opções de entrega de leads</Ui> (ou <Ui>Exportar leads do Google Ads</Ui>).</>,
            <>Em <strong>Integração de webhook</strong>, cole a <strong>URL</strong> e a <strong>Chave</strong> acima.</>,
            <>Clique em <Ui>Enviar dados de teste</Ui>. Deve aparecer “sucesso” e um contato de teste em Contatos.</>,
            <>Salve o formulário. Pronto: cada novo lead chega em segundos.</>,
          ]}
        />
      </div>
    );
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-foreground/85">
        Portais imobiliários e outros sistemas podem mandar os interessados direto para o Ápice. Basta informar o endereço abaixo no painel do portal.
      </p>
      <CopyField label="Endereço de integração (webhook)" value={url} />
      <Instructions
        items={[
          <>No painel do portal (ex.: <strong>Canal Pro</strong> do Grupo OLX/ZAP), procure por <Ui>Integração de leads</Ui>, <Ui>CRM</Ui> ou <Ui>Webhook</Ui>.</>,
          <>Cole o endereço acima e salve. Se o portal pedir o formato, escolha <strong>JSON</strong>.</>,
          <>Não encontrou a opção? Envie esta mensagem ao suporte do portal: <em>“Quero receber meus leads por webhook (POST JSON) neste endereço: {url}”</em>.</>,
        ]}
      />
      <Callout title="Para desenvolvedores">
        Aceitamos POST JSON com <code>name</code>, <code>phone</code>, <code>email</code>, <code>message</code> e <code>listing_id</code>, ou o formato nativo dos portais.
      </Callout>
    </div>
  );
}

export function LeadSources({ kind, items, onChanged }: { kind: Kind; items: Integration[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const { isManager } = useCan();
  const { data: pipelines } = usePipelines();
  const [adding, setAdding] = useState<{ type: string; name: string } | null>(null);
  const [cfg, setCfg] = useState<Integration | null>(null);
  const [stageId, setStageId] = useState("");
  const list = items.filter((i) => TYPES[kind].includes(i.type));

  const patch = useMutation({
    mutationFn: (p: { id: string; isEnabled?: boolean; config?: Record<string, unknown> }) => api(`/api/integrations/${p.id}`, { method: "PATCH", body: p }),
    onSuccess: () => { onChanged(); toast.success("Integração atualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: (d: { type: string; name: string }) => api("/api/integrations", { body: d }),
    onSuccess: () => { onChanged(); setAdding(null); toast.success("Integração criada — agora siga o passo a passo"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => { onChanged(); toast.success("Integração removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function sendTest(i: Integration) {
    const res = await fetch(i.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lead de teste (Ápice)", phone: "11900000000", email: "teste@apice.app", message: `Teste da integração ${i.name}` }),
    });
    if (res.ok) {
      toast.success("Lead de teste recebido! Veja em Contatos (pode excluir depois).");
      onChanged();
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } else toast.error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "O teste falhou");
  }

  return (
    <div className="space-y-4">
      {!list.length && (
        <Card className="p-6">
          <EmptyState
            icon={<Webhook className="h-6 w-6" />}
            title="Nenhuma integração ainda"
            description="Crie a integração para receber o endereço exclusivo e siga o passo a passo — leva uns 5 minutos."
            action={isManager ? <Button onClick={() => setAdding({ type: TYPES[kind][0], name: TYPE_LABEL[TYPES[kind][0]] })}><Plus /> Criar integração</Button> : undefined}
          />
        </Card>
      )}
      {list.map((i) => (
        <Card key={i.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-extrabold">{i.name} <Badge tone={i.isEnabled ? "green" : "slate"}>{i.isEnabled ? "Ativa" : "Pausada"}</Badge></p>
              <p className="text-xs text-muted-foreground">{TYPE_LABEL[i.type]} · {i.leadsReceived} leads recebidos · último {i.lastEventAt ? formatDate(i.lastEventAt, true) : "ainda nenhum"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => sendTest(i)} disabled={!i.isEnabled}><FlaskConical /> Enviar lead de teste</Button>
            {isManager && <Button size="sm" variant="ghost" onClick={() => { setCfg(i); setStageId(String(i.configJson.stageId ?? "")); }}><Settings2 /> Etapa</Button>}
            {isManager && <Switch checked={i.isEnabled} onCheckedChange={(v) => patch.mutate({ id: i.id, isEnabled: v })} aria-label="Ativar integração" />}
            {isManager && <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Remover ${i.name}? O endereço deixa de funcionar.`) && remove.mutate(i.id)} aria-label="Remover"><Trash2 /></Button>}
          </div>
          <div className="p-5"><HowTo kind={kind} url={i.webhookUrl} /></div>
        </Card>
      ))}
      {isManager && !!list.length && <Button variant="outline" size="sm" onClick={() => setAdding({ type: TYPES[kind][0], name: "" })}><Plus /> Adicionar outra</Button>}

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent size="sm" title="Nova integração" description="Você recebe um endereço exclusivo para colar na plataforma de anúncios.">
          {adding && (
            <DialogBody className="space-y-3">
              {TYPES[kind].length > 1 && (
                <Field label="De onde vêm os leads?">
                  <Select value={adding.type} onChange={(e) => setAdding({ type: e.target.value, name: TYPE_LABEL[e.target.value] })}>
                    {TYPES[kind].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Nome para identificar" hint="Ex.: Formulário Feirão de Novembro">
                <Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
              </Field>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>Cancelar</Button>
            <Button onClick={() => adding && create.mutate({ type: adding.type, name: adding.name || TYPE_LABEL[adding.type] })} loading={create.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cfg} onOpenChange={(o) => !o && setCfg(null)}>
        <DialogContent size="sm" title="Onde os leads entram" description="Escolha o funil e a etapa em que os novos contatos desta integração aparecem.">
          <DialogBody>
            <Field label="Etapa de entrada">
              <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">Primeira etapa do funil padrão</option>
                {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => {
              const pipelineId = pipelines?.find((p) => p.stages.some((s) => s.id === stageId))?.id;
              patch.mutate({ id: cfg!.id, config: { ...cfg!.configJson, stageId: stageId || undefined, pipelineId } });
              setCfg(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
