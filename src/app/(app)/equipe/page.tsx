"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, KeyRound, Plus, Shield, Shuffle, UserMinus, Users } from "lucide-react";
import { api } from "@/lib/client";
import { DEFAULT_ASSISTANT_PERMISSIONS, MODULE_LABELS, ORIGIN_SHORT, ROLE_LABELS, type ModuleKey } from "@/lib/constants";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import type { TeamUser } from "@/lib/types";
import { useCan, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, Switch } from "@/components/ui/overlay";

type Roulette = { history: { id: string; title: string; createdAt: string; user: { name: string } | null; contact: { id: string; name: string | null; phone: string; origin: string } }[]; next: { id: string; name: string } | null };

const ROLE_DESC: Record<string, string> = {
  MANAGER: "Acesso total: vê todos os leads, conversas e números, configura o Téo e a equipe.",
  ASSISTANT: "Permissões granulares por módulo (definidas abaixo).",
  BROKER: "Acesso restrito aos próprios leads, conversas e agenda.",
};

function PermissionsDialog({ user, onClose }: { user: TeamUser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<Record<string, boolean>>({});
  const [uid, setUid] = useState<string | null>(null);
  if (user && user.id !== uid) {
    setUid(user.id);
    setP({ ...DEFAULT_ASSISTANT_PERMISSIONS, ...user.permissions });
  }
  const save = useMutation({
    mutationFn: () => api(`/api/users/${user!.id}`, { method: "PATCH", body: { permissions: p } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Permissões salvas"); onClose(); },
  });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Permissões de ${user?.name}`} description="Assistente: escolha os módulos que ele pode acessar." size="md">
        <DialogBody className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Checkbox checked={!!p[m]} onChange={(e) => setP({ ...p, [m]: e.target.checked })} /> {MODULE_LABELS[m]}</label>
            ))}
          </div>
          <label className="mt-2 flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2.5 text-sm">
            <span><strong>Ver leads de toda a equipe</strong><span className="block text-xs text-muted-foreground">Se desligado, vê apenas os leads atribuídos a ele.</span></span>
            <Switch checked={!!p.verTodosLeads} onCheckedChange={(v) => setP({ ...p, verTodosLeads: v })} />
          </label>
        </DialogBody>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "BROKER" });
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const invite = useMutation({
    mutationFn: () => api<{ user: { email: string }; tempPassword: string }>("/api/users", { body: f }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["users"] }); setResult({ email: r.user.email, tempPassword: r.tempPassword }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setResult(null); setF({ name: "", email: "", phone: "", role: "BROKER" }); } }}>
      <DialogContent title="Convidar membro" size="md">
        {result ? (
          <DialogBody className="space-y-3 text-center">
            <KeyRound className="mx-auto h-10 w-10 text-success" />
            <p className="text-sm">Acesso criado para <strong>{result.email}</strong>.</p>
            <p className="text-xs text-muted-foreground">Senha provisória (mostrada só agora):</p>
            <p className="rounded-md bg-slate-900 py-2 font-mono text-lg text-emerald-300">{result.tempPassword}</p>
          </DialogBody>
        ) : (
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="WhatsApp (recebe os leads da roleta)"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Perfil" className="sm:col-span-2" hint={ROLE_DESC[f.role]}>
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="MANAGER">Gestor</option><option value="ASSISTANT">Assistente</option><option value="BROKER">Corretor/Vendedor</option></Select>
            </Field>
          </DialogBody>
        )}
        <DialogFooter>
          {result ? <Button onClick={() => onOpenChange(false)}>Concluir</Button> : <><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={f.name.length < 2 || !f.email.includes("@")}>Convidar</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Equipe() {
  const qc = useQueryClient();
  const { isManager, me } = useCan();
  const { data: team } = useTeam();
  const { data: roulette } = useQuery({ queryKey: ["roulette"], queryFn: () => api<Roulette>("/api/roulette") });
  const [invite, setInvite] = useState(false);
  const [perm, setPerm] = useState<TeamUser | null>(null);
  const patch = useMutation({
    mutationFn: (p: { id: string } & Record<string, unknown>) => api(`/api/users/${p.id}`, { method: "PATCH", body: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["roulette"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Membro desativado e leads liberados"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const brokers = (team ?? []).filter((u) => u.role === "BROKER" && u.isActive);
  const onDuty = brokers.filter((b) => b.inRoulette);
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageHeader title="Equipe" description="Perfis de acesso (RBAC) e roleta de distribuição de leads." actions={isManager && <Button size="sm" onClick={() => setInvite(true)}><Plus /> Convidar membro</Button>} />
      <div className="grid gap-3 md:grid-cols-3">
        {(["MANAGER", "ASSISTANT", "BROKER"] as const).map((r) => (
          <Card key={r} className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">{r === "MANAGER" ? <Crown className="h-4 w-4 text-amber-500" /> : r === "ASSISTANT" ? <Shield className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-emerald-600" />} {ROLE_LABELS[r]} <Badge className="ml-auto">{team?.filter((u) => u.role === r && u.isActive).length ?? 0}</Badge></p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESC[r]}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader title="Membros" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2">Membro</th><th className="px-3 py-2">Perfil</th><th className="px-3 py-2 text-right">Leads</th><th className="px-3 py-2">Plantão</th><th className="px-3 py-2">Peso</th><th className="px-3 py-2" /></tr></thead>
              <tbody>
                {team?.map((u) => (
                  <tr key={u.id} className={cn("border-t", !u.isActive && "opacity-50")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={32} />
                        <div><p className="font-medium">{u.name} {u.id === me?.user.id && <span className="text-xs text-muted-foreground">(você)</span>}</p><p className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${formatPhone(u.phone)}` : ""}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Select disabled={!isManager || u.id === me?.user.id} value={u.role} onChange={(e) => patch.mutate({ id: u.id, role: e.target.value, inRoulette: e.target.value === "BROKER" ? u.inRoulette : false })} className="h-8 w-36 text-xs">
                        <option value="MANAGER">Gestor</option><option value="ASSISTANT">Assistente</option><option value="BROKER">Corretor</option>
                      </Select>
                      {u.role === "ASSISTANT" && isManager && <button onClick={() => setPerm(u)} className="mt-1 block text-[11px] text-primary hover:underline">Permissões por módulo</button>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{u.leadsCount}</td>
                    <td className="px-3 py-2.5">{u.role === "BROKER" ? <Switch disabled={!isManager || !u.isActive} checked={u.inRoulette} onCheckedChange={(v) => patch.mutate({ id: u.id, inRoulette: v })} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5">{u.role === "BROKER" ? <Select disabled={!isManager} value={String(u.rouletteWeight)} onChange={(e) => patch.mutate({ id: u.id, rouletteWeight: Number(e.target.value) })} className="h-8 w-16 text-xs">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select> : null}</td>
                    <td className="px-3 py-2.5 text-right">
                      {isManager && u.id !== me?.user.id && (u.isActive ? <Button size="icon-sm" variant="ghost" title="Desativar" onClick={() => confirm(`Desativar ${u.name}? Os leads dele ficarão sem responsável.`) && remove.mutate(u.id)}><UserMinus /></Button> : <Button size="xs" variant="outline" onClick={() => patch.mutate({ id: u.id, isActive: true })}>Reativar</Button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Shuffle className="h-4 w-4 text-primary" /> Roleta de distribuição</span>} description="Round-robin ponderado entre os corretores de plantão" />
          <div className="space-y-4 p-4">
            <div className="rounded-lg bg-gradient-to-r from-primary/[0.06] to-secondary/[0.08] p-3">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Próximo da fila</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold">{roulette?.next ? <><Avatar name={roulette.next.name} size={24} /> {roulette.next.name}</> : "Nenhum corretor no plantão"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{onDuty.length} de {brokers.length} corretores no plantão</p>
            </div>
            <div className="flex flex-wrap gap-1.5">{brokers.map((b) => <Badge key={b.id} tone={b.inRoulette ? "green" : "slate"}>{b.inRoulette ? "🟢" : "⏸️"} {b.name.split(" ")[0]} {b.lastAssignedAt && `· ${timeAgo(b.lastAssignedAt)}`}</Badge>)}</div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Últimos leads distribuídos</p>
              <div className="max-h-80 space-y-2 overflow-y-auto scrollbar-thin">
                {roulette?.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <Avatar name={h.user?.name ?? "?"} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate"><strong>{h.contact.name ?? formatPhone(h.contact.phone)}</strong> → {h.user?.name ?? "sem responsável"}</p>
                      <p className="text-[10px] text-muted-foreground">{ORIGIN_SHORT[h.contact.origin]} · {timeAgo(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
      <InviteDialog open={invite} onOpenChange={setInvite} />
      <PermissionsDialog user={perm} onClose={() => setPerm(null)} />
    </div>
  );
}
