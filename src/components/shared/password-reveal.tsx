"use client";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

/** Mostra (uma única vez) o acesso criado e um texto pronto para mandar à pessoa pelo WhatsApp. */
export function PasswordReveal({ data, onClose, title = "Acesso criado" }: { data: { name?: string; email: string; tempPassword: string } | null; onClose: () => void; title?: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const invite = data
    ? `Olá${data.name ? `, ${data.name.split(" ")[0]}` : ""}! Seu acesso ao Ápice está pronto.\n\n🔗 ${url}\n📧 ${data.email}\n🔑 Senha provisória: ${data.tempPassword}\n\nNo primeiro acesso você vai criar a sua própria senha.`
    : "";
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" title={title} description="Esta senha aparece só agora. Copie e envie para a pessoa.">
        {data && (
          <DialogBody className="space-y-4 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary"><KeyRound className="h-7 w-7" /></span>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">E-mail de acesso</p>
              <p className="font-bold">{data.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Senha provisória</p>
              <p className="rounded-xl border bg-background py-3 font-mono text-xl font-bold tracking-wider text-primary dark:text-secondary">{data.tempPassword}</p>
            </div>
            <p className="text-xs text-muted-foreground">No primeiro acesso o sistema pede para a pessoa criar uma senha própria.</p>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(invite); toast.success("Convite copiado — cole no WhatsApp da pessoa"); }}><Copy /> Copiar convite</Button>
          <Button onClick={onClose}>Pronto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
