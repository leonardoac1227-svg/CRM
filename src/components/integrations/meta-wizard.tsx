"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Loader2, MessageCircle, PartyPopper } from "lucide-react";
import { api } from "@/lib/client";
import { formatPhone } from "@/lib/utils";
import type { Channel } from "@/lib/types";
import { useChannelSetup } from "@/hooks/use-channel-setup";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { Callout, Checklist, CopyField, ExtLink, Instructions, StepRail, Ui } from "./wizard-kit";

const STEPS = ["Antes de começar", "Conta e app", "Número", "Token", "Conectar", "Receber mensagens", "Ativar e testar"];

type Form = { name: string; metaAccessToken: string; metaPhoneNumberId: string; metaWabaId: string; metaAppSecret: string };

/**
 * Assistente da API oficial do WhatsApp (Meta Cloud API), escrito para quem nunca mexeu no painel da Meta.
 * `channel` reabre um número já salvo direto no passo do webhook.
 */
export function MetaWizard({ open, onOpenChange, channel }: { open: boolean; onOpenChange: (v: boolean) => void; channel?: Channel | null }) {
  const qc = useQueryClient();
  const { data: setup } = useChannelSetup();
  const [step, setStep] = useState(0);
  const [check, setCheck] = useState<Record<string, boolean>>({});
  const [f, setF] = useState<Form>({ name: "WhatsApp da empresa", metaAccessToken: "", metaPhoneNumberId: "", metaWabaId: "", metaAppSecret: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Channel | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [gotMessage, setGotMessage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaved(channel ?? null);
    setStep(channel ? 5 : 0);
    setGotMessage(false);
    setBaseline(channel?.lastActivityAt ?? null);
  }, [open, channel]);

  // Último passo: espera a mensagem de teste chegar
  useEffect(() => {
    if (!open || step !== 6 || !saved || gotMessage) return;
    const t = setInterval(async () => {
      const list = await api<Channel[]>("/api/channels").catch(() => []);
      const c = list.find((x) => x.id === saved.id);
      if (c?.lastActivityAt && c.lastActivityAt !== baseline && (c._count?.conversations ?? 0) > 0) {
        setGotMessage(true);
        qc.invalidateQueries({ queryKey: ["channels"] });
      }
    }, 4000);
    return () => clearInterval(t);
  }, [open, step, saved, baseline, gotMessage, qc]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.trim() === "" ? "" : e.target.value });

  async function saveChannel() {
    setSaving(true);
    try {
      const r = await api<Channel & { verified: { phone: string | null; verifiedName: string | null } }>("/api/channels", {
        body: { ...f, provider: "META_OFFICIAL", accountType: "COMPANY", metaAccessToken: f.metaAccessToken.trim(), metaPhoneNumberId: f.metaPhoneNumberId.trim(), metaWabaId: f.metaWabaId.trim() },
      });
      setSaved(r);
      setBaseline(r.lastActivityAt);
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(`Conectado: ${r.verified.verifiedName ?? r.name} ${r.verified.phone ? `· ${r.verified.phone}` : ""}`);
      setStep(5);
    } catch (e) {
      toast.error((e as Error).message, { duration: 9000 });
    } finally {
      setSaving(false);
    }
  }

  const canNext =
    step === 0 ? !!(check.facebook && check.number && check.computer) :
    step === 4 ? !!saved :
    true;

  const body = [
    // 0 — antes de começar
    <div key="0" className="space-y-4">
      <p className="text-[15px] leading-relaxed">
        A <strong>API oficial</strong> é o jeito profissional de usar o WhatsApp no Ápice: não tem risco de bloqueio, permite disparos de campanha e
        o número fica conectado 24 horas, sem depender de celular ligado. Leva uns <strong>20 minutos</strong> e você só precisa fazer uma vez.
      </p>
      <p className="eyebrow">Confira se você tem</p>
      <Checklist
        value={check}
        onChange={setCheck}
        items={[
          { key: "facebook", label: "Uma conta pessoal no Facebook", hint: "É com ela que você entra no painel da Meta. Pode ser a do dono da empresa." },
          { key: "number", label: "Um número de celular que NÃO esteja no aplicativo WhatsApp", hint: "Pode ser um chip novo ou um número fixo. Se o número já usa o WhatsApp, é preciso apagar a conta dele no app antes (Configurações › Conta › Apagar conta)." },
          { key: "computer", label: "Um computador com este painel aberto", hint: "Você vai copiar e colar alguns códigos entre o site da Meta e o Ápice." },
        ]}
      />
      <Callout title="Quanto custa?">
        Responder clientes que mandaram mensagem é <strong>gratuito</strong>. A Meta só cobra quando a empresa inicia a conversa com um modelo aprovado
        (campanhas, lembretes). O valor aparece no Ápice antes de cada disparo, e a cobrança é feita pela Meta no cartão cadastrado lá.
      </Callout>
    </div>,

    // 1 — conta e app
    <div key="1" className="space-y-4">
      <p className="text-[15px]">Primeiro vamos criar um “app” na Meta. É só um cadastro que libera o WhatsApp para o Ápice — você não precisa programar nada.</p>
      <Instructions
        items={[
          <>Abra o <ExtLink href="https://developers.facebook.com/apps/">painel de desenvolvedores da Meta</ExtLink> e entre com o seu Facebook. Se for o primeiro acesso, aceite os termos e confirme seu e-mail/telefone.</>,
          <>Clique em <Ui>Criar app</Ui>.</>,
          <>Em “Casos de uso”, escolha <Ui>Conectar-se com clientes pelo WhatsApp</Ui> e clique em <Ui>Avançar</Ui>.</>,
          <>Dê um nome ao app (ex.: <em>Ápice – sua empresa</em>) e informe seu e-mail.</>,
          <>Quando pedir o <strong>portfólio empresarial</strong>, escolha o da sua empresa. Se não tiver, clique em <Ui>Criar um portfólio empresarial</Ui> e preencha nome da empresa e seu nome.</>,
          <>Clique em <Ui>Criar app</Ui> e confirme sua senha do Facebook se ela for pedida.</>,
        ]}
      />
      <Callout tone="info">Já tem um app da Meta com WhatsApp? Pode usar o mesmo e pular para o próximo passo.</Callout>
    </div>,

    // 2 — número
    <div key="2" className="space-y-4">
      <p className="text-[15px]">Agora vamos colocar o número da sua empresa dentro do app.</p>
      <Instructions
        items={[
          <>No menu da esquerda do app, abra <Ui>WhatsApp</Ui> › <Ui>Configuração da API</Ui> (em inglês: <em>API Setup</em>).</>,
          <>Role até o passo 5 da página e clique em <Ui>Adicionar número de telefone</Ui>.</>,
          <>Preencha o <strong>nome de exibição</strong> (é o nome que seus clientes vão ver, ex.: <em>Horizonte Imóveis</em>), a categoria e o fuso horário.</>,
          <>Digite o número com DDD e escolha receber o código por <strong>SMS</strong> ou <strong>ligação</strong>. Digite o código recebido.</>,
          <>Pronto: o número aparece na lista. O nome de exibição passa por uma análise rápida da Meta, mas você já pode continuar.</>,
        ]}
      />
      <Callout tone="warn" title="Erro “este número já está registrado”?">
        O número ainda está no aplicativo WhatsApp. No celular, abra o WhatsApp (ou WhatsApp Business) › <strong>Configurações › Conta › Apagar minha conta</strong>, espere alguns minutos e tente de novo.
      </Callout>
    </div>,

    // 3 — token
    <div key="3" className="space-y-4">
      <p className="text-[15px]">
        O <strong>token</strong> é uma senha longa que deixa o Ápice enviar e receber mensagens pelo seu número. O token que aparece na página da API
        expira em 24 horas — por isso vamos gerar um <strong>permanente</strong>.
      </p>
      <Instructions
        items={[
          <>Abra as <ExtLink href="https://business.facebook.com/settings/system-users">Configurações do negócio › Usuários do sistema</ExtLink>.</>,
          <>Clique em <Ui>Adicionar</Ui>, dê o nome <em>Ápice</em>, escolha a função <Ui>Administrador</Ui> e confirme.</>,
          <>Com o usuário selecionado, clique em <Ui>Atribuir ativos</Ui>: em <strong>Apps</strong> marque o seu app com <strong>Controle total</strong>; em <strong>Contas do WhatsApp</strong> marque a sua conta com <strong>Controle total</strong>. Salve.</>,
          <>Clique em <Ui>Gerar token</Ui>, escolha o seu app e, em validade, selecione <Ui>Nunca</Ui>.</>,
          <>Marque as permissões <Ui>whatsapp_business_messaging</Ui> e <Ui>whatsapp_business_management</Ui> e clique em <Ui>Gerar token</Ui>.</>,
          <>Copie o token (começa com <code>EAA…</code>) e guarde por um minuto — ele só aparece uma vez. No próximo passo você vai colar aqui.</>,
        ]}
      />
    </div>,

    // 4 — conectar
    <div key="4" className="space-y-4">
      <p className="text-[15px]">
        Volte em <Ui>WhatsApp</Ui> › <Ui>Configuração da API</Ui>, escolha o seu número no campo “De” e copie os dois códigos que aparecem logo abaixo dele.
      </p>
      {saved ? (
        <Callout tone="ok" title="Número conectado!">
          {saved.metaVerifiedName ?? saved.name} · {formatPhone(saved.phoneNumber)}. Siga para o próximo passo.
        </Callout>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Como chamar este número no Ápice" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="Token permanente" className="sm:col-span-2" hint="O código longo que começa com EAA, gerado no passo anterior.">
            <Input value={f.metaAccessToken} onChange={set("metaAccessToken")} placeholder="EAA..." className="font-mono text-xs" autoComplete="off" />
          </Field>
          <Field label="Identificação do número de telefone" hint="Em inglês: Phone number ID. Só números.">
            <Input value={f.metaPhoneNumberId} onChange={set("metaPhoneNumberId")} inputMode="numeric" placeholder="1234567890123456" className="font-mono" />
          </Field>
          <Field label="Identificação da conta do WhatsApp Business" hint="Em inglês: WhatsApp Business Account ID.">
            <Input value={f.metaWabaId} onChange={set("metaWabaId")} inputMode="numeric" placeholder="1234567890123456" className="font-mono" />
          </Field>
          <Field label="Chave secreta do app (opcional, recomendado)" className="sm:col-span-2" hint={<>Fica em <strong>Configurações do app › Básico › Chave secreta do app</strong> (clique em Mostrar). Protege o recebimento contra mensagens falsas.</>}>
            <Input value={f.metaAppSecret} onChange={set("metaAppSecret")} className="font-mono text-xs" autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={saveChannel} loading={saving} disabled={!f.metaAccessToken || !f.metaPhoneNumberId || !f.metaWabaId} className="w-full" size="lg">
              <BadgeCheck /> Testar com a Meta e salvar
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">O Ápice confere os dados direto na Meta antes de salvar.</p>
          </div>
        </div>
      )}
    </div>,

    // 5 — webhook
    <div key="5" className="space-y-4">
      <p className="text-[15px]">Agora vamos avisar a Meta para entregar ao Ápice as mensagens que seus clientes mandarem.</p>
      {setup && !setup.publicUrlOk && (
        <Callout tone="warn" title="Endereço local">O Ápice está rodando em um endereço local ({setup.appUrl}). A Meta só consegue entregar mensagens para um endereço público na internet — faça esta etapa no sistema publicado.</Callout>
      )}
      <div className="grid gap-3">
        <CopyField label="URL de callback" value={setup?.meta.webhookUrl ?? "…"} />
        <CopyField label="Token de verificação" value={setup?.meta.verifyToken ?? "Somente gestores veem este token"} secret />
      </div>
      <Instructions
        items={[
          <>No app da Meta, abra <Ui>WhatsApp</Ui> › <Ui>Configuração</Ui> (em inglês: <em>Configuration</em>).</>,
          <>Na seção <strong>Webhook</strong>, clique em <Ui>Editar</Ui>.</>,
          <>Cole a <strong>URL de callback</strong> e o <strong>Token de verificação</strong> acima e clique em <Ui>Verificar e salvar</Ui>.</>,
          <>Ainda nessa página, em <strong>Campos do webhook</strong>, clique em <Ui>Gerenciar</Ui> e ative (<Ui>Assinar</Ui>) o campo <code>messages</code>.</>,
        ]}
      />
      <Callout tone="info">Se a Meta mostrar “não foi possível validar a URL”, confira se copiou o token inteiro e se o sistema está no ar (abra o endereço do Ápice em outra aba para “acordá-lo” e tente de novo).</Callout>
    </div>,

    // 6 — ativar e testar
    <div key="6" className="space-y-4">
      <p className="text-[15px]">Último passo! Apps novos começam em “modo de desenvolvimento”, que só funciona com números de teste. Vamos colocar no ar.</p>
      <Instructions
        items={[
          <>No app da Meta, abra <Ui>Configurações do app</Ui> › <Ui>Básico</Ui>.</>,
          <>Preencha a <strong>URL da Política de Privacidade</strong> (pode ser a página de privacidade do site da empresa) e salve.</>,
          <>No topo da página, mude o <strong>Modo do app</strong> de <Ui>Desenvolvimento</Ui> para <Ui>Ao vivo</Ui> (ou <Ui>Publicar</Ui>).</>,
          <>Pegue o seu celular pessoal e mande um “oi” para o número da empresa.</>,
        ]}
      />
      <div className="flex items-center gap-4 rounded-2xl border p-5">
        {gotMessage ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-white"><PartyPopper className="h-6 w-6" /></span>
            <div>
              <p className="display text-xl leading-none">Funcionou!</p>
              <p className="mt-1 text-sm text-muted-foreground">A mensagem chegou no Atendimento. Seu WhatsApp oficial está pronto.</p>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-secondary"><Loader2 className="h-6 w-6 animate-spin" /></span>
            <div>
              <p className="font-bold">Esperando a sua mensagem de teste…</p>
              <p className="mt-1 text-sm text-muted-foreground">Assim que ela chegar, esta tela confirma sozinha. Pode levar alguns segundos.</p>
            </div>
          </>
        )}
      </div>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Conectar o WhatsApp oficial (API da Meta)" description={`Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}>
        <div className="border-b px-5 py-3"><StepRail steps={STEPS} current={step} onJump={setStep} /></div>
        <DialogBody className="min-h-[360px]">
          <div key={step} className="animate-rise">{body[step]}</div>
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}>
            {step === 0 ? "Fechar" : <><ArrowLeft /> Voltar</>}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === 4 && !saved ? "Salve o número para continuar" : <>Próximo <ArrowRight /></>}
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)} variant={gotMessage ? "default" : "outline"}>
              {gotMessage ? <><CheckCircle2 /> Concluir</> : <><MessageCircle /> Testar depois</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
