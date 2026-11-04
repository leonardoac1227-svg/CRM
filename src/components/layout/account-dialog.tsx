"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

/** Minha conta. Com `forced`, é a tela obrigatória de criar senha no primeiro acesso. */
export function AccountDialog({ open, onOpenChange, forced }: { open: boolean; onOpenChange: (v: boolean) => void; forced?: boolean }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", phone: "", currentPassword: "", newPassword: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (open && me) setF({ name: me.user.name, phone: me.user.phone ?? "", currentPassword: "", newPassword: "", confirm: "" });
  }, [open, me]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const changing = forced || !!f.newPassword;
  const mismatch = !!f.confirm && f.newPassword !== f.confirm;

  async function save() {
    if (changing && f.newPassword.length < 8) return toast.error("A nova senha precisa ter pelo menos 8 caracteres");
    if (changing && f.newPassword !== f.confirm) return toast.error("As senhas não conferem");
    setLoading(true);
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        body: {
          name: f.name,
          phone: f.phone || null,
          ...(changing ? { newPassword: f.newPassword, currentPassword: forced ? undefined : f.currentPassword } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(changing ? "Senha criada! Use ela nos próximos acessos." : "Dados salvos");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !forced && onOpenChange(v)}>
      <DialogContent
        size="sm"
        hideClose={forced}
        title={forced ? "Crie a sua senha" : "Minha conta"}
        description={forced ? "Você entrou com uma senha provisória. Para proteger a conta, escolha uma senha só sua." : me?.user.email}
        onInteractOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
      >
        <DialogBody className="space-y-3">
          {forced && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-xs">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" />
              <span>Use pelo menos 8 caracteres. Uma frase curta que só você conhece funciona bem (ex.: <em>cafe-com-leite-2026</em>).</span>
            </div>
          )}
          {!forced && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome"><Input value={f.name} onChange={set("name")} /></Field>
              <Field label="WhatsApp" hint="Recebe os avisos de leads da roleta"><Input value={f.phone} onChange={set("phone")} placeholder="(75) 99999-0000" /></Field>
            </div>
          )}
          {!forced && <p className="eyebrow pt-2">Trocar senha (opcional)</p>}
          {!forced && <Field label="Senha atual"><Input type="password" value={f.currentPassword} onChange={set("currentPassword")} autoComplete="current-password" /></Field>}
          <Field label="Nova senha"><Input type="password" value={f.newPassword} onChange={set("newPassword")} autoComplete="new-password" /></Field>
          <Field label="Repita a nova senha" hint={mismatch ? "As senhas não conferem" : undefined}><Input type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></Field>
        </DialogBody>
        <DialogFooter>
          {!forced && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          <Button onClick={save} loading={loading}>{forced ? "Criar senha e entrar" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
