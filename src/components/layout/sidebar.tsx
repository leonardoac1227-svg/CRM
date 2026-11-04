"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { useNavBadges } from "@/hooks/use-nav-badges";
import { readCollapsed, useUi } from "@/stores/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { Avatar } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlay";
import { ApiceMark, ApiceWordmark } from "@/components/brand/logo";
import { NAV_GROUPS, activeNavItem, navAllowed, type NavItem } from "./nav-config";

function NavLink({ item, collapsed, active, badge, assistant, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; badge: number; assistant: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const label = item.ai ? assistant : item.label;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-[13.5px] font-semibold transition-colors",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "h-10 px-3",
        active ? "bg-[rgb(var(--brand)/0.14)] text-gold" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[rgb(var(--brand))]" aria-hidden="true" />}
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-gold" : "text-sidebar-muted group-hover:text-white", item.ai && !active && "text-gold/80")} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge > 0 &&
        (collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F0A56B] ring-2 ring-sidebar" aria-label={`${badge} pendentes`} />
        ) : (
          <span className="min-w-[22px] rounded-full bg-[rgb(var(--brand)/0.16)] px-1.5 py-0.5 text-center text-[11px] font-extrabold text-gold">{badge > 99 ? "99+" : badge}</span>
        ))}
    </Link>
  );
  if (!collapsed) return link;
  return <Tooltip content={item.ai ? `${assistant} — ${item.label}` : `${label}${badge ? ` · ${badge}` : ""}`} side="right">{link}</Tooltip>;
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const { badges } = useNavBadges();
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const assistant = me?.assistantName ?? "Zeni";
  const active = activeNavItem(pathname);
  const isAgency = me?.user.role === "AGENCY_ADMIN" || me?.user.role === "SUPER_ADMIN";

  return (
    <div className="flex h-full flex-col">
      <Link href="/central" onClick={onNavigate} className={cn("flex items-center gap-3 py-4", collapsed ? "justify-center px-0" : "px-5")} aria-label="Ápice — Central">
        {me?.agency.logoUrl && !collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.agency.logoUrl} alt={me.agency.name} className="h-8 max-w-[170px] object-contain" />
        ) : (
          <>
            <ApiceMark size={collapsed ? 34 : 38} />
            {!collapsed && <ApiceWordmark by={me?.agency.name} />}
          </>
        )}
      </Link>

      {!collapsed && me && (
        <Link href={isAgency ? "/clientes" : "/central"} onClick={onNavigate} title={isAgency ? "Trocar de cliente" : undefined} className="mx-3 mb-3 flex items-center gap-3 transition-colors hover:border-[rgb(var(--brand)/0.5)] rounded-xl border border-sidebar-border bg-white/[0.03] px-3 py-2.5 [@media(max-height:760px)]:hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--brand)/0.14)] text-[12px] font-extrabold text-gold">
            {me.workspace.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-white">{me.workspace.name}</span>
            <span className="block truncate text-[11px] text-sidebar-muted">{[me.workspace.city, me.workspace.state].filter(Boolean).join(" · ") || "Workspace"}</span>
          </span>
          {isAgency && <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />}
        </Link>
      )}

      <div className={cn("mb-3", collapsed ? "px-2" : "px-3")}>
        <button
          onClick={() => setCommandOpen(true)}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-black/20 text-[13px] text-sidebar-muted transition-colors hover:border-[rgb(var(--brand)/0.5)] hover:text-white",
            collapsed ? "justify-center" : "px-3",
          )}
          aria-label="Buscar ou perguntar"
        >
          <Search className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Buscar ou perguntar…</span>
              <kbd className="rounded-md border border-sidebar-border px-1.5 py-0.5 font-sans text-[10px] font-bold">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      <nav aria-label="Navegação principal" className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 scrollbar-thin", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((i) => navAllowed(i, me));
          if (!items.length) return null;
          return (
            <div key={g.key} className="space-y-0.5">
              {collapsed ? (
                <div className="mx-auto mb-1.5 h-px w-6 bg-sidebar-border" aria-hidden="true" />
              ) : (
                <p className={cn("px-3 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.2em]", g.key === "ia" ? "text-gold/80" : "text-sidebar-muted")}>
                  {g.key === "ia" ? `${assistant} · IA` : g.label}
                </p>
              )}
              {items.map((i) => (
                <NavLink key={i.href} item={i} collapsed={collapsed} active={active?.href === i.href} badge={i.badge ? badges[i.badge] : 0} assistant={assistant} onNavigate={onNavigate} />
              ))}
            </div>
          );
        })}
      </nav>

      {me && (
        <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
          {!collapsed && (
            <Link href="/ia/automacoes" onClick={onNavigate} className="mb-3 block rounded-xl border [@media(max-height:900px)]:hidden border-[rgb(var(--brand)/0.25)] bg-[radial-gradient(130%_130%_at_100%_0%,rgb(var(--brand)/0.18),transparent_60%)] p-3 transition-colors hover:border-[rgb(var(--brand)/0.5)]">
              <span className="flex items-center gap-2 text-[12.5px] font-extrabold text-gold">
                <span className="h-2 w-2 animate-pulse-gold rounded-full bg-gold" /> {assistant} está ativa
              </span>
              <span className="mt-1 block text-[11.5px] leading-snug text-sidebar-foreground">Atende, qualifica e distribui seus leads 24 horas por dia.</span>
            </Link>
          )}
          <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
            <Avatar name={me.user.name} size={34} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{me.user.name}</span>
                <span className="block truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[me.user.role]}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  const mobileOpen = useUi((s) => s.mobileNavOpen);
  const setMobileOpen = useUi((s) => s.setMobileNavOpen);
  const pathname = usePathname();

  useEffect(() => {
    if (readCollapsed()) setCollapsed(true);
  }, [setCollapsed]);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[268px]",
        )}
      >
        <SidebarBody collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-7 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-md transition-colors hover:text-gold"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 w-[284px] max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-2xl animate-[slide-in-left_0.22s_ease-out]">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-5 rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-white" aria-label="Fechar menu">
              <X className="h-4 w-4" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
