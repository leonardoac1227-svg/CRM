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
    { key: "ai", label: `Com o ${assistantName}`, count: counts?.ai },
  ];
  return (
    <div className="flex h-full w-full flex-col border-r bg-white md:w-[340px] md:shrink-0">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Select value={channelId} onChange={(e) => onChannel(e.target.value)} className="h-8 flex-1 text-xs">
          <option value="">Todos os números ({channels.length})</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.status === "CONNECTED" ? "🟢" : c.status === "ATTENTION" ? "🟡" : "🔴"} {c.name} · {formatPhone(c.phoneNumber)}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={onNew}><Plus /> Novo</Button>
      </div>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar por nome, telefone ou mensagem" className="h-8 w-full rounded-md border bg-slate-50 pl-8 pr-2 text-xs outline-none focus:border-primary/50 focus:bg-white" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn("rounded-md border p-1.5 text-slate-500 hover:bg-muted", (assignedFilter || showClosed) && "border-primary text-primary")} aria-label="Filtros"><Filter className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3">
            {canFilterUsers && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Responsável</p>
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
      <div className="flex gap-1 border-b px-3 py-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => onTab(t.key)} className={cn("flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors", tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            {t.label}
            {!!t.count && <span className={cn("rounded-full px-1.5 text-[10px]", tab === t.key ? "bg-primary text-white" : "bg-slate-200 text-slate-600")}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && !items.length && Array.from({ length: 6 }).map((_, i) => <div key={i} className="mx-3 my-2 h-14 animate-pulse rounded-md bg-slate-100" />)}
        {!loading && !items.length && <p className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhuma conversa encontrada.</p>}
        {items.map((c) => {
          const unread = c.unreadCount > 0;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} className={cn("flex w-full gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50", selectedId === c.id && "bg-primary/[0.06] hover:bg-primary/[0.08]")}>
              <div className="relative">
                <Avatar name={c.contact.name ?? c.contact.phone} size={40} />
                {c.aiActive && <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-white ring-2 ring-white"><Bot className="h-2.5 w-2.5" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{c.contact.name ?? formatPhone(c.contact.phone)}</p>
                  <span className={cn("shrink-0 text-[10px]", unread ? "font-semibold text-success" : "text-muted-foreground")}>{chatTime(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-xs", unread ? "text-slate-700" : "text-muted-foreground")}>{c.lastMessagePreview}</p>
                  {unread && <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-success px-1 text-[10px] font-semibold text-white">{c.unreadCount}</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{c.channel?.accountType === "BROKER" ? "📱" : "🏢"} {c.channel?.name}</span>
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
