"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { useRealtime } from "@/hooks/use-realtime";
import { useUi } from "@/stores/ui";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";
import { AccountDialog } from "./account-dialog";
import { ContactDrawer } from "@/components/contacts/contact-drawer";

const ROUTE_MODULE: [string, string][] = [
  ["/atendimento", "atendimento"], ["/contatos", "contatos"], ["/funis", "funis"], ["/imoveis", "imoveis"], ["/agenda", "agenda"],
  ["/ia", "teo"], ["/relatorios", "relatorios"], ["/campanhas", "campanhas"], ["/site-seo", "site-seo"], ["/integracoes", "integracoes"], ["/equipe", "equipe"],
];

function NoAccess() {
  return (
    <div className="flex min-h-app flex-col items-center justify-center p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary"><Lock className="h-6 w-6" /></span>
      <p className="mt-3 font-semibold">Seu perfil não tem acesso a este módulo</p>
      <p className="mt-1 text-sm text-muted-foreground">Peça ao gestor para liberar o acesso em Equipe.</p>
      <Link href="/central" className="mt-4 text-sm font-bold text-primary hover:underline dark:text-secondary">Voltar para a Central</Link>
    </div>
  );
}

/** Bloqueia telas de módulos que o perfil não pode acessar (a API também valida). */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const pathname = usePathname();
  const mod = ROUTE_MODULE.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1];
  if (me && mod && !me.modules.includes(mod)) return <NoAccess />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  useRealtime(!!me);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const contactId = useUi((s) => s.contactDrawerId);
  const openContact = useUi((s) => s.openContact);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette />
      <ContactDrawer contactId={contactId} onClose={() => openContact(null)} />
      <AccountDialog open={!!me?.mustChangePassword} onOpenChange={() => undefined} forced />
    </div>
  );
}
