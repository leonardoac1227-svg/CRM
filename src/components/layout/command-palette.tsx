"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building, FileText, LayoutGrid, MessageSquare, Search, User, Sparkles } from "lucide-react";
import { api, qs } from "@/lib/client";
import { formatPhone } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import { useMe } from "@/hooks/use-me";

type Result = {
  contacts: { id: string; name: string | null; phone: string; stage: { name: string } | null }[];
  conversations: { id: string; lastMessagePreview: string | null; contact: { name: string | null; phone: string } }[];
  catalog: { id: string; title: string; code: string }[];
  templates: { id: string; name: string }[];
};

const PAGES = [
  { href: "/atendimento", label: "Atendimento", module: "atendimento" },
  { href: "/contatos", label: "Contatos", module: "contatos" },
  { href: "/funis", label: "Funis", module: "funis" },
  { href: "/imoveis", label: "Imóveis", module: "imoveis" },
  { href: "/agenda", label: "Agenda", module: "agenda" },
  { href: "/teo", label: "Téo ✨ — Copiloto", module: "teo" },
  { href: "/teo/automacoes", label: "Téo ✨ — Automações", module: "teo" },
  { href: "/relatorios", label: "Relatórios", module: "relatorios" },
  { href: "/campanhas", label: "Campanhas", module: "campanhas" },
  { href: "/campanhas/modelos", label: "Modelos de mensagem", module: "campanhas" },
  { href: "/site-seo", label: "Site & SEO", module: "site-seo" },
  { href: "/integracoes", label: "Integrações", module: "integracoes" },
  { href: "/equipe", label: "Equipe", module: "equipe" },
  { href: "/getting-started", label: "Onde começar", module: null },
];

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const openContact = useUi((s) => s.openContact);
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  const { data } = useQuery({ queryKey: ["search", debounced], queryFn: () => api<Result>(`/api/search${qs({ q: debounced })}`), enabled: open && debounced.length >= 2 });
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const item = "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground";
  const group = "px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-white shadow-2xl">
          <DialogPrimitive.Title className="sr-only">Buscar no CRM</DialogPrimitive.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Buscar contatos, conversas, imóveis, páginas…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1 scrollbar-thin">
              <Command.Empty className="px-4 py-8 text-center text-xs text-muted-foreground">Nada encontrado.</Command.Empty>
              {!!data?.contacts.length && (
                <Command.Group heading="Contatos" className={group}>
                  {data.contacts.map((c) => (
                    <Command.Item key={c.id} value={`c-${c.id}`} onSelect={() => { setOpen(false); openContact(c.id); }} className={item}>
                      <User /> <span className="flex-1">{c.name ?? "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{formatPhone(c.phone)} · {c.stage?.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!data?.conversations.length && (
                <Command.Group heading="Mensagens" className={group}>
                  {data.conversations.map((c) => (
                    <Command.Item key={c.id} value={`m-${c.id}`} onSelect={() => go(`/atendimento?conversa=${c.id}`)} className={item}>
                      <MessageSquare /> <span className="w-36 truncate font-medium">{c.contact.name ?? formatPhone(c.contact.phone)}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!data?.catalog.length && (
                <Command.Group heading="Imóveis" className={group}>
                  {data.catalog.map((c) => (
                    <Command.Item key={c.id} value={`i-${c.id}`} onSelect={() => go(`/imoveis?q=${c.code}`)} className={item}>
                      <Building /> <span className="flex-1">{c.title}</span> <span className="text-xs text-muted-foreground">{c.code}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!data?.templates.length && (
                <Command.Group heading="Modelos" className={group}>
                  {data.templates.map((t) => (
                    <Command.Item key={t.id} value={`t-${t.id}`} onSelect={() => go(`/campanhas/modelos`)} className={item}>
                      <FileText /> {t.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {q.length > 2 && me?.modules.includes("teo") && (
                <Command.Group heading="Perguntar ao Téo" className={group}>
                  <Command.Item value="ask-teo" onSelect={() => go(`/teo?q=${encodeURIComponent(q)}`)} className={item}>
                    <Sparkles /> Perguntar: “{q}”
                  </Command.Item>
                </Command.Group>
              )}
              <Command.Group heading="Ir para" className={group}>
                {PAGES.filter((p) => (!p.module || me?.modules.includes(p.module)) && (!q || p.label.toLowerCase().includes(q.toLowerCase()))).map((p) => (
                  <Command.Item key={p.href} value={p.href} onSelect={() => go(p.href)} className={item}>
                    <LayoutGrid /> {p.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
