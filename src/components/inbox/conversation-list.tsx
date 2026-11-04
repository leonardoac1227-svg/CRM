"use client";
import { Filter, Plus, Search, Bot } from "lucide-react";
import { cn, chatTime, formatPhone } from "@/lib/utils";
import type { Channel, ConversationListItem, TeamUser } from "@/lib/types";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";

export type InboxTab = "all" | "unread" | "reply" | "ai";

export function ConversationList({
  items, counts, tab, onTab, q, onQ, channels, channelId, onChannel, selectedId, onSelect, onNew, assistantName,
  team, assignedFilter, onAssignedFilter, showClosed, onShowClosed, canFilterUsers, loading,
}: {
  items: ConversationListItem[];
  counts?: { all: number; unread: number; reply: number; ai: number };
  tab: InboxTab;
  onTab: (t: InboxTab) => void;
  q: string;
  onQ: (v: string) => void;
  channels: Channel[];
  channelId: string;
  onChannel: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  assistantName: string;
  team: TeamUser[];
  assignedFilter: string;
  onAssignedFilter: (v: string) => void;
  showClosed: boolean;
  onShowClosed: (v: boolean) => void;
  canFilterUsers: boolean;
  loading?: boolean;
}) {
  const tabs: { key: InboxTab; label: string; count?: number }[] = [
    { key: "all", label: "Todos" },
    { key: "unread", label: "Não lidos", count: counts?.unread },
    { key: "reply", label: "A responder", count: counts?.reply },
    { key: "ai", label: `Com a ${assistantName}`, count: counts?.ai },
  ];
  return (
    <div className="flex h-full w-full flex-col border-r bg-card/60 md:w-[360px] md:shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
        <h2 className="display text-[22px] leading-none">Conversas</h2>
        <Button size="sm" onClick={onNew}><Plus /> Nova</Button>
      </div>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Select value={channelId} onChange={(e) => onChannel(e.target.value)} className="h-9 flex-1 text-xs">
          <option value="">Todos os números ({channels.length})</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.status === "CONNECTED" ? "🟢" : c.status === "ATTENTION" ? "🟡" : "🔴"} {c.name} · {formatPhone(c.phoneNumber)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => onQ(e.target.value)} aria-label="Buscar conversas" placeholder="Buscar nome, telefone ou mensagem" className="h-9 w-full rounded-lg border bg-background pl-9 pr-2 text-[13px] outline-none transition-colors focus:border-primary/60" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn("flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted", (assignedFilter || showClosed) && "border-primary text-primary")} aria-label="Filtros"><Filter className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3">
            {canFilterUsers && (
              <div>
                <p className="mb-1 text-xs font-medium text-foreground/75">Responsável</p>
                <Select value={assignedFilter} onChange={(e) => onAssignedFilter(e.target.value)} className="h-8 text-xs">
                  <option value="">Todos</option>
                  <option value="none">Sem responsável</option>
                  {team.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={showClosed} onChange={(e) => onShowClosed(e.target.checked)} /> Incluir conversas encerradas</label>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-3 scrollbar-thin">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => onTab(t.key)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors", tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:border-primary/50")}>
            {t.label}
            {!!t.count && <span className={cn("rounded-full px-1.5 text-[10px] font-extrabold", tab === t.key ? "bg-black/15" : "bg-muted text-foreground/75")}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && !items.length && Array.from({ length: 6 }).map((_, i) => <div key={i} className="mx-3 my-2 h-14 animate-pulse rounded-md bg-muted" />)}
        {!loading && !items.length && <p className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhuma conversa encontrada.</p>}
        {items.map((c) => {
          const unread = c.unreadCount > 0;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} className={cn("relative flex w-full gap-3 border-b border-border/70 px-4 py-3.5 text-left transition-colors hover:bg-muted/60", selectedId === c.id && "bg-primary/10 hover:bg-primary/10")}>
              {selectedId === c.id && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
              <div className="relative">
                <Avatar name={c.contact.name ?? c.contact.phone} size={42} />
                {c.aiActive && <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"><Bot className="h-2.5 w-2.5" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-[13.5px]", unread ? "font-extrabold" : "font-bold")}>{c.contact.name ?? formatPhone(c.contact.phone)}</p>
                  <span className={cn("shrink-0 text-[10px]", unread ? "font-bold text-primary dark:text-secondary" : "text-muted-foreground")}>{chatTime(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-xs", unread ? "text-foreground/90" : "text-muted-foreground")}>{c.lastMessagePreview}</p>
                  {unread && <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">{c.unreadCount}</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="truncate rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground/75">{c.channel?.accountType === "BROKER" ? "📱" : "🏢"} {c.channel?.name}</span>
                  {c.assignedTo && <span className="truncate text-[10px] text-muted-foreground">· {c.assignedTo.name.split(" ")[0]}</span>}
                  {!c.windowOpen && c.channel?.provider === "META_OFFICIAL" && <span className="text-[10px] text-amber-600" title="Janela de 24h fechada">· ⏳ 24h</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
