"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Check, MessageCircle, Plus, Users } from "lucide-react";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { PasswordReveal } from "@/components/shared/password-reveal";

type Client = {
  id: string;
  name: string;
  niche: string;
  city: string | null;
  state: string | null;
  createdAt: string;
  current: boolean;
  manager: { name: string; email: string } | null;
  channelsConnected: number;
  channelsTotal: number;
  _count: { users: number; contacts: number; conversations: number };
};

const NICHES: Record<string, string> = { IMOBILIARIO: "Imobiliária", SERVICOS: "Serviços", CLINICA: "Clínica / Saúde", ECOMMERCE: "E-commerce", OUTROS: "Outro" };
const EMPTY = { name: "", niche: "IMOBILIARIO", city: "", state: "", siteUrl: "", managerName: "", managerEmail: "", managerPhone: "" };

function NewClientDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (r: { name: string; email: string; tempPassword: string }) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: () => api<{ manager: { name: string; email: string }; tempPassword: string }>("/api/agency/clients", { body: f }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["agency-clients"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onOpenChange(false);
      setF(EMPTY);
      onCreated({ name: r.manager.name, email: r.manager.email, tempPassword: r.tempPassword });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Novo cliente" description="Crie a empresa e o acesso de quem vai administrar o Ápice por lá.">
        <DialogBody className="space-y-5">
          <div className="space-y-3">
            <p className="eyebrow">1 · A empresa</p>
            <Field label="Nome da empresa"><Input value={f.name} onChange={set("name")} placeholder="Ex.: Horizonte Imóveis" /></Field>
            <div className="grid grid-cols-[1fr_1fr_80px] gap-3">
              <Field label="Segmento">
                <Select value={f.niche} onChange={set("niche")}>{Object.entries(NICHES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              </Field>
              <Field label="Cidade"><Input value={f.city} onChange={set("city")} /></Field>
              <Field label="UF"><Input value={f.state} onChange={set("state")} maxLength={2} /></Field>
            </div>
            <Field label="Site (opcional)" hint="Usado no rastreio de SEO. Dá para preencher depois."><Input value={f.siteUrl} onChange={set("siteUrl")} placeholder="https://www.empresa.com.br" /></Field>
          </div>
          <div className="space-y-3">
            <p className="eyebrow">2 · Quem vai administrar</p>
            <Field label="Nome do responsável (gestor)"><Input value={f.managerName} onChange={set("managerName")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail de acesso"><Input type="email" value={f.managerEmail} onChange={set("managerEmail")} /></Field>
              <Field label="WhatsApp"><Input value={f.managerPhone} onChange={set("managerPhone")} placeholder="(75) 99999-0000" /></Field>
            </div>
            <p className="text-xs text-muted-foreground">Vamos gerar uma senha provisória. No primeiro acesso, o gestor cria a própria senha.</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={f.name.length < 2 || f.managerName.length < 2 || !f.managerEmail.includes("@")}>Criar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ["agency-clients"], queryFn: () => api<Client[]>("/api/agency/clients") });
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const agency = me?.user.role === "AGENCY_ADMIN" || me?.user.role === "SUPER_ADMIN";

  async function enter(id: string) {
    await api("/api/auth/workspace", { body: { workspaceId: id } });
    window.location.href = "/central";
  }

  if (me && !agency) return <EmptyState icon={<Briefcase className="h-6 w-6" />} title="Área da agência" description="Somente a agência gerencia os clientes." className="min-h-app" />;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Configurar"
        icon={<Briefcase />}
        title="Clientes"
        description={`Empresas atendidas pela ${me?.agency.name ?? "agência"}. Cada cliente tem o próprio WhatsApp, equipe, funis e rastreio de SEO.`}
        actions={<Button onClick={() => setOpen(true)}><Plus /> Novo cliente</Button>}
      />

      {isLoading && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((c, i) => (
          <Card key={c.id} className="card-hover flex animate-rise flex-col p-5" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-display text-base font-semibold text-primary dark:text-secondary">
                {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{NICHES[c.niche] ?? c.niche}{c.city ? ` · ${c.city}${c.state ? `/${c.state}` : ""}` : ""}</p>
              </div>
              {c.current && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-extrabold text-primary dark:text-secondary"><Check className="h-3 w-3" /> Aberto</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border bg-background/50 py-2"><p className="font-display text-lg font-semibold">{c._count.contacts}</p><p className="text-[10.5px] text-muted-foreground">contatos</p></div>
              <div className="rounded-lg border bg-background/50 py-2"><p className="font-display text-lg font-semibold">{c._count.users}</p><p className="text-[10.5px] text-muted-foreground">usuários</p></div>
              <div className="rounded-lg border bg-background/50 py-2"><p className="font-display text-lg font-semibold">{c.channelsConnected}/{c.channelsTotal}</p><p className="text-[10.5px] text-muted-foreground">WhatsApp</p></div>
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {c.manager ? `${c.manager.name} · ${c.manager.email}` : "Sem gestor cadastrado"}</p>
              <p className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> {c.channelsConnected ? "WhatsApp conectado" : "WhatsApp ainda não conectado"} · desde {formatDate(c.createdAt)}</p>
            </div>
            <Button variant={c.current ? "outline" : "soft"} size="sm" className="mt-4" onClick={() => enter(c.id)} disabled={c.current}>
              {c.current ? "Você está neste cliente" : <>Entrar neste cliente <ArrowRight /></>}
            </Button>
          </Card>
        ))}
        {!isLoading && (
          <button onClick={() => setOpen(true)} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-5 text-sm font-bold text-primary transition-colors hover:border-primary/60 hover:bg-primary/5 dark:text-secondary">
            <Plus className="h-6 w-6" /> Cadastrar novo cliente
          </button>
        )}
      </div>

      <NewClientDialog open={open} onOpenChange={setOpen} onCreated={setCreated} />
      <PasswordReveal data={created} onClose={() => setCreated(null)} title="Cliente criado!" />
    </div>
  );
}
