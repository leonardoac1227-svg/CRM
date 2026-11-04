"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, Search, Sparkles, Building2, UserCog, Check, PlayCircle, BookOpen, Keyboard, Plus, Sun, Moon, MessageSquarePlus, UserPlus, CalendarPlus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { api } from "@/lib/client";
import { ROLE_LABELS } from "@/lib/constants";
import { useMe } from "@/hooks/use-me";
import { useState } from "react";
import { useUi } from "@/stores/ui";
import { AccountDialog } from "./account-dialog";
import { useTheme } from "@/hooks/use-theme";
import { ApiceMark } from "@/components/brand/logo";
import { activeNavItem, groupOf } from "./nav-config";
import { Avatar, Kbd } from "@/components/ui/misc";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/overlay";

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
        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notificações">
          <Bell className="h-[18px] w-[18px]" />
          {!!data?.unread && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F0A56B] ring-2 ring-background px-1 text-[10px] font-semibold text-[#0A0E17]">{data.unread > 9 ? "9+" : data.unread}</span>}
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
              className={cn("flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60", !n.isRead && "bg-primary/5")}
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
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  async function switchWorkspace(workspaceId: string) {
    await api("/api/auth/workspace", { body: { workspaceId } });
    qc.clear();
    window.location.href = "/central";
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  if (!me) return <div className="h-8 w-8 rounded-full bg-muted" />;
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-muted">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
          <UserCog /> Minha conta e senha
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout} className="text-red-600">
          <LogOut className="!text-red-500" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}

const CREATE = [
  { href: "/atendimento?nova=1", label: "Nova conversa", hint: "Iniciar pelo WhatsApp", icon: MessageSquarePlus, module: "atendimento" },
  { href: "/contatos?novo=1", label: "Novo contato", hint: "Cadastrar ou importar", icon: UserPlus, module: "contatos" },
  { href: "/agenda?nova=1", label: "Nova tarefa", hint: "Visita, ligação ou follow-up", icon: CalendarPlus, module: "agenda" },
  { href: "/imoveis?novo=1", label: "Novo imóvel", hint: "Item do catálogo", icon: Building2, module: "imoveis" },
  { href: "/campanhas?novo=1", label: "Nova campanha", hint: "Disparo oficial da Meta", icon: Megaphone, module: "campanhas" },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className="hidden h-10 w-10 sm:flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} title={theme === "dark" ? "Tema claro" : "Tema escuro"}>
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const setMobileOpen = useUi((s) => s.setMobileNavOpen);
  const assistant = me?.assistantName ?? "Zeni";
  const item = activeNavItem(pathname);
  const group = groupOf(item);
  const can = (m: string) => !me || me.modules.includes(m);
  const create = CREATE.filter((c) => can(c.module));
  const Icon = item?.icon;

  return (
    <header className="sticky top-0 z-30 h-[var(--topbar-h)] border-b bg-background/85 backdrop-blur-xl">
      <div className="flex h-full items-center gap-2 px-3 md:px-6">
        <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/central" className="mr-1 hidden sm:block lg:hidden" aria-label="Central">
          <ApiceMark size={30} />
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary dark:text-secondary sm:flex">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="hidden text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground sm:block">{group ? (group.key === "ia" ? `${assistant} · IA` : group.label) : "Ápice"}</p>
            <p className="truncate text-[15px] font-bold">{item ? (item.ai ? `${assistant} · Copiloto` : item.label) : "Ápice"}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setCommandOpen(true)} className="mr-1 hidden h-10 w-72 items-center gap-2 rounded-xl border bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary/50 xl:flex">
            <Search className="h-4 w-4" /> <span className="flex-1 text-left">Buscar contatos, conversas, imóveis…</span> <Kbd>Ctrl K</Kbd>
          </button>
          <button onClick={() => setCommandOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted xl:hidden" aria-label="Buscar">
            <Search className="h-[18px] w-[18px]" />
          </button>
          {can("teo") && (
            <button onClick={() => router.push("/ia")} className="hidden h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-[13px] font-bold text-primary transition-colors hover:bg-primary/20 dark:text-secondary md:flex">
              <Sparkles className="h-4 w-4" /> Perguntar à {assistant}
            </button>
          )}
          {!!create.length && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-extrabold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]">
                  <Plus className="h-4 w-4" strokeWidth={2.6} /> <span className="hidden sm:inline">Criar</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Criar novo</DropdownMenuLabel>
                {create.map((c) => (
                  <DropdownMenuItem key={c.href} onSelect={() => router.push(c.href)} className="py-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-secondary"><c.icon className="h-4 w-4" /></span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{c.label}</span>
                      <span className="text-[11px] text-muted-foreground">{c.hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <ThemeToggle />
          <Popover>
            <PopoverTrigger asChild>
              <button className="hidden h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:flex" aria-label="Ajuda">
                <HelpCircle className="h-[18px] w-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
              <Link href="/getting-started" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"><PlayCircle className="h-4 w-4 text-primary" /> Primeiros passos</Link>
              <Link href="/getting-started?tour=1" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"><BookOpen className="h-4 w-4 text-primary" /> Fazer o tour pelo Ápice</Link>
              <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground"><Keyboard className="h-4 w-4" /> <Kbd>Ctrl K</Kbd> busca global</div>
            </PopoverContent>
          </Popover>
          <Notifications />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
