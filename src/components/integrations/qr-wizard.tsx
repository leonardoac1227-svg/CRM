"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, PartyPopper, QrCode, RefreshCw, Server, Smartphone } from "lucide-react";
import { api } from "@/lib/client";
import type { Channel } from "@/lib/types";
import { useCan, useTeam } from "@/hooks/use-me";
import { useChannelSetup } from "@/hooks/use-channel-setup";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { Callout, Instructions, StepRail, Ui } from "./wizard-kit";

const STEPS = ["Qual número", "Escanear o QR Code", "Pronto"];

/** Conecta um WhatsApp comum (celular do corretor ou da empresa) lendo um QR Code, como no WhatsApp Web. */
export function QrWizard({ open, onOpenChange, channel }: { open: boolean; onOpenChange: (v: boolean) => void; channel?: Channel | null }) {
  const qc = useQueryClient();
  const { me, isManager } = useCan();
  const { data: team } = useTeam();
  const { data: setup } = useChannelSetup();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", phoneNumber: "", accountType: "BROKER", userId: "" });
  const [ch, setCh] = useState<Channel | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const lastQrAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    setConnected(false);
    setQr(null);
    if (channel) {
      setCh(channel);
      setStep(1);
      void generate(channel);
    } else {
      setCh(null);
      setStep(0);
      setF({ name: isManager ? "" : me?.user.name ?? "", phoneNumber: isManager ? "" : me?.user.phone ?? "", accountType: isManager ? "BROKER" : "BROKER", userId: isManager ? "" : me?.user.id ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel]);

  async function generate(c: Channel) {
    setBusy(true);
    try {
      const r = await api<{ status: string; qrCode: string | null }>(`/api/channels/${c.id}/connect`, { method: "POST" });
      lastQrAt.current = Date.now();
      if (r.status === "CONNECTED") {
        setConnected(true);
        setStep(2);
      } else setQr(r.qrCode);
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  // Enquanto o QR está na tela: confere a conexão a cada 3 s e troca o QR quando ele vence
  useEffect(() => {
    if (!open || step !== 1 || !ch || connected) return;
    const t = setInterval(async () => {
      const r = await api<{ status: string; qrCode: string | null }>(`/api/channels/${ch.id}/status`).catch(() => null);
      if (!r) return;
      if (r.status === "CONNECTED") {
        setConnected(true);
        setStep(2);
        qc.invalidateQueries({ queryKey: ["channels"] });
        qc.invalidateQueries({ queryKey: ["workspace"] });
        return;
      }
      if (r.qrCode) setQr(r.qrCode);
      if (Date.now() - lastQrAt.current > 45_000) void generate(ch);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, ch, connected]);

  async function create() {
    setBusy(true);
    try {
      const c = await api<Channel>("/api/channels", { body: { ...f, provider: "EVOLUTION_QR", userId: f.userId || null } });
      setCh(c);
      qc.invalidateQueries({ queryKey: ["channels"] });
      setStep(1);
      await generate(c);
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  const notReady = setup && !setup.evolution.configured;

  const body = [
    <div key="0" className="space-y-4">
      {notReady ? (
        <Callout tone="warn" title="Falta ligar o servidor de QR Code">
          Para conectar celulares pelo QR Code, o Ápice usa um servidor chamado <strong>Evolution API</strong>. Ele ainda não foi configurado nesta instalação.
          O administrador precisa seguir o passo “WhatsApp por QR Code” do guia <em>Colocar no ar</em> e preencher <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code>.
          Enquanto isso, você pode usar a <strong>API oficial</strong>.
        </Callout>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed">
            Funciona igual ao <strong>WhatsApp Web</strong>: você aponta a câmera do celular para um código e pronto. As conversas desse número passam a aparecer no
            Ápice, e o celular continua funcionando normalmente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {isManager && (
              <Field label="De quem é este número?">
                <Select value={f.accountType} onChange={(e) => setF({ ...f, accountType: e.target.value, userId: e.target.value === "COMPANY" ? "" : f.userId })}>
                  <option value="BROKER">De um corretor / vendedor</option>
                  <option value="COMPANY">Da empresa</option>
                </Select>
              </Field>
            )}
            {isManager && f.accountType === "BROKER" && (
              <Field label="Qual pessoa da equipe">
                <Select value={f.userId} onChange={(e) => { const u = team?.find((x) => x.id === e.target.value); setF({ ...f, userId: e.target.value, name: u?.name ?? f.name, phoneNumber: u?.phone ?? f.phoneNumber }); }}>
                  <option value="">Selecione…</option>
                  {team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Nome para identificar"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Márcio – celular" /></Field>
            <Field label="Número do WhatsApp (com DDD)"><Input value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} placeholder="(75) 99999-0000" inputMode="tel" /></Field>
          </div>
          <Callout title="Bom saber">
            O celular precisa ficar com internet. Use este modo para atender — para disparos em massa prefira a API oficial, porque o WhatsApp pode bloquear números
            comuns que mandam muitas mensagens de uma vez.
          </Callout>
        </>
      )}
    </div>,

    <div key="1" className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
      <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-2xl border bg-white p-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code para conectar o WhatsApp" className="h-full w-full" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /> Gerando o código…</span>
        )}
      </div>
      <div className="space-y-4">
        <Instructions
          items={[
            <>Abra o <strong>WhatsApp</strong> no celular {f.phoneNumber || ch?.phoneNumber ? <>do número <strong>{f.phoneNumber || ch?.phoneNumber}</strong></> : null}.</>,
            <>No Android toque em <Ui>⋮</Ui> (três pontinhos). No iPhone toque em <Ui>Configurações</Ui>.</>,
            <>Toque em <Ui>Dispositivos conectados</Ui> › <Ui>Conectar um dispositivo</Ui>.</>,
            <>Aponte a câmera para o código ao lado. Pronto!</>,
          ]}
        />
        <div className="flex items-center gap-3 rounded-xl border bg-background/50 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Aguardando a leitura… o código se renova sozinho a cada 45 segundos.</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => ch && generate(ch)} loading={busy}><RefreshCw /> Gerar outro código</Button>
      </div>
    </div>,

    <div key="2" className="flex flex-col items-center py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success text-white"><PartyPopper className="h-8 w-8" /></span>
      <p className="display mt-4 text-2xl">WhatsApp conectado!</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        As novas mensagens deste número já chegam no Atendimento. Não desconecte o Ápice em “Dispositivos conectados” no celular — se isso acontecer, é só gerar um novo QR Code aqui.
      </p>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Conectar WhatsApp pelo QR Code" description={`Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}>
        <div className="border-b px-5 py-3"><StepRail steps={STEPS} current={step} /></div>
        <DialogBody className="min-h-[340px]">
          <div key={step} className="animate-rise">{body[step]}</div>
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => (step === 1 && !channel ? setStep(0) : onOpenChange(false))}>
            {step === 1 && !channel ? <><ArrowLeft /> Voltar</> : "Fechar"}
          </Button>
          {step === 0 && !notReady && (
            <Button onClick={create} loading={busy} disabled={f.name.trim().length < 2 || f.phoneNumber.replace(/\D/g, "").length < 10}>
              <QrCode /> Gerar QR Code <ArrowRight />
            </Button>
          )}
          {step === 0 && notReady && <Button variant="outline" disabled><Server /> Aguardando o servidor</Button>}
          {step === 1 && <Button variant="outline" disabled><Smartphone /> Escaneie com o celular</Button>}
          {step === 2 && <Button onClick={() => onOpenChange(false)}><CheckCircle2 /> Concluir</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
