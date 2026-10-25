"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { useRealtime } from "@/hooks/use-realtime";
import { useUi } from "@/stores/ui";
import { CommandPalette } from "./command-palette";
import { ContactDrawer } from "@/components/contacts/contact-drawer";

const ROUTE_MODULE: [string, string][] = [
  ["/atendimento", "atendimento"], ["/contatos", "contatos"], ["/funis", "funis"], ["/imoveis", "imoveis"], ["/agenda", "agenda"],
  ["/teo", "teo"], ["/relatorios", "relatorios"], ["/campanhas", "campanhas"], ["/site-seo", "site-seo"], ["/integracoes", "integracoes"], ["/equipe", "equipe"],
];

function NoAccess() {
  return (
    <div className="flex min-h-app flex-col items-center justify-center p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Lock className="h-5 w-5" /></span>
      <p className="mt-3 font-semibold">Seu perfil não tem acesso a este módulo</p>
      <p className="mt-1 text-sm text-muted-foreground">Peça ao gestor para liberar o acesso em Equipe.</p>
      <Link href="/atendimento" className="mt-4 text-sm font-medium text-primary hover:underline">Ir para o Atendimento</Link>
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
    <>
      {children}
      <CommandPalette />
      <ContactDrawer contactId={contactId} onClose={() => openContact(null)} />
    </>
  );
}
