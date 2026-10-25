"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, Search, Sparkles, Building2, UserCog, Check, PlayCircle, BookOpen, Keyboard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { api } from "@/lib/client";
import { ROLE_LABELS } from "@/lib/constants";
import { useMe } from "@/hooks/use-me";
import { useUi } from "@/stores/ui";
import { Avatar, Kbd } from "@/components/ui/misc";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/overlay";

const NAV = [
  { href: "/atendimento", label: "Atendimento", module: "atendimento" },
  { href: "/contatos", label: "Contatos", module: "contatos" },
  { href: "/funis", label: "Funis", module: "funis" },
  { href: "/imoveis", label: "Imóveis", module: "imoveis" },
  { href: "/agenda", label: "Agenda", module: "agenda" },
  { href: "/teo", label: "TEO", module: "teo", ai: true },
];
const MORE = [
  { href: "/relatorios", label: "Relatórios", module: "relatorios" },
  { href: "/campanhas", label: "Campanhas", module: "campanhas" },
  { href: "/site-seo", label: "Site & SEO", module: "site-seo" },
  { href: "/integracoes", label: "Integrações", module: "integracoes" },
  { href: "/equipe", label: "Equipe", module: "equipe" },
];

type Notification = { id: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

function Notifications() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ items: Notification[]; unread: number }>("/api/notifications"), refetchInterval: 60_000 });
  async function markAll() {
    await api("/api/notifications", { body: { all: true } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-slate-500 hover:bg-muted hover:text-foreground" aria-label="Notificações">
          <Bell className="h-[18px] w-[18px]" />
          {!!data?.unread && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          <button onClick={markAll} className="text-xs text-primary hover:underline">Marcar todas como lidas</button>
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {!data?.items.length && <p className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma notificação por aqui.</p>}
          {data?.items.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.isRead) await api("/api/notifications", { body: { ids: [n.id] } });
                qc.invalidateQueries({ queryKey: ["notifications"] });
                if (n.link) router.push(n.link);
              }}
              className={cn("flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60", !n.isRead && "bg-primary/[0.04]")}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.title}</span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu() {
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api<{ profiles: { id: string; name: string; role: string; email: string }[] }>("/api/auth/profiles"),
    enabled: !!me?.demoMode,
  });
  async function switchTo(userId: string) {
    await api("/api/auth/switch", { body: { userId } });
    qc.clear();
    toast.success("Perfil alterado");
    router.refresh();
    window.location.reload();
  }
  async function switchWorkspace(workspaceId: string) {
    await api("/api/auth/workspace", { body: { workspaceId } });
    qc.clear();
    window.location.href = "/getting-started";
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  if (!me) return <div className="h-8 w-8 rounded-full bg-muted" />;
  const groups: [string, string[]][] = [
    ["Gestor", ["MANAGER"]],
    ["Assistente", ["ASSISTANT"]],
    ["Corretor", ["BROKER"]],
    ["Agência SEO", ["AGENCY_ADMIN"]],
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-muted">
          <Avatar name={me.user.name} size={30} />
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-xs font-semibold">{me.user.name.split(" ")[0]}</span>
            <span className="block text-[10px] text-muted-foreground">{ROLE_LABELS[me.user.role]}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground xl:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={me.user.name} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
            <p className="text-[11px] text-primary">{ROLE_LABELS[me.user.role]} · {me.workspace.name}</p>
          </div>
        </div>
        {me.workspaces.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Clientes da agência</DropdownMenuLabel>
            {me.workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onSelect={() => switchWorkspace(w.id)}>
                <Building2 /> <span className="flex-1 truncate">{w.name}</span> {w.id === me.workspace.id && <Check className="!text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {me.demoMode && !!profiles?.profiles.length && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Testar visão como…</DropdownMenuLabel>
            {groups.map(([label, roles]) => {
              const list = profiles.profiles.filter((p) => roles.includes(p.role));
              if (!list.length) return null;
              return list.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => switchTo(p.id)}>
                  <UserCog />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  {p.id === me.user.id && <Check className="!text-primary" />}
                </DropdownMenuItem>
              ));
            })}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-red-600">
          <LogOut className="!text-red-500" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const can = (m: string) => !me || me.modules.includes(m);
  const assistant = me?.assistantName ?? "Téo";
  const nav = NAV.filter((n) => can(n.module));
  const more = MORE.filter((n) => can(n.module));
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 h-[var(--topbar-h)] border-b bg-white/95 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-3 md:px-5">
        <button className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/getting-started" className="flex shrink-0 flex-col leading-none">
          {me?.agency.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.agency.logoUrl} alt={me.agency.name} className="h-6 max-w-[140px] object-contain" />
          ) : (
            <span className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-white"><Sparkles className="h-3.5 w-3.5" /></span>
              <span>{me?.agency.name ?? "Téo CRM"}</span>
            </span>
          )}
          <span className="mt-0.5 text-[10px] font-medium text-primary hover:underline">Ver onde começar</span>
        </Link>

        <nav className={cn("ml-3 hidden items-center gap-0.5 lg:flex")}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", isActive(n.href) ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted hover:text-foreground")}>
              {n.ai ? <span className="flex items-center gap-1">{assistant} <Sparkles className="h-3.5 w-3.5 text-secondary" /></span> : n.label}
            </Link>
          ))}
          {more.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium outline-none", more.some((m) => isActive(m.href)) ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted")}>
                Mais <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {more.map((m) => (
                  <DropdownMenuItem key={m.href} asChild>
                    <Link href={m.href} className={cn(isActive(m.href) && "text-primary")}>{m.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setCommandOpen(true)} className="mr-1 hidden h-8 w-64 items-center gap-2 rounded-md border bg-muted/50 px-2.5 text-xs text-muted-foreground hover:bg-muted md:flex">
            <Search className="h-3.5 w-3.5" /> <span className="flex-1 text-left">Buscar no CRM...</span> <Kbd>Ctrl+K</Kbd>
          </button>
          <button onClick={() => setCommandOpen(true)} className="rounded-md p-2 text-slate-500 hover:bg-muted md:hidden" aria-label="Buscar">
            <Search className="h-[18px] w-[18px]" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded-md p-2 text-slate-500 hover:bg-muted hover:text-foreground" aria-label="Ajuda">
                <HelpCircle className="h-[18px] w-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
              <Link href="/getting-started" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><PlayCircle className="h-4 w-4 text-primary" /> Onde começar</Link>
              <Link href="/getting-started?tour=1" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><BookOpen className="h-4 w-4 text-primary" /> Fazer um passeio pelo sistema</Link>
              <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground"><Keyboard className="h-4 w-4" /> <Kbd>Ctrl+K</Kbd> busca global</div>
            </PopoverContent>
          </Popover>
          <Notifications />
          <ProfileMenu />
        </div>
      </div>
      {mobileOpen && (
        <div className="border-b bg-white px-3 pb-3 shadow-sm lg:hidden">
          <div className="grid grid-cols-2 gap-1 pt-2">
            {[...nav, ...more].map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className={cn("rounded-md px-3 py-2 text-sm font-medium", isActive(n.href) ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted")}>
                {n.href === "/teo" ? `${assistant} ✨` : n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
