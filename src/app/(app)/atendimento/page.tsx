"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Inbox, Zap, Users } from "lucide-react";
import { api, qs } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Channel, ConversationListItem } from "@/lib/types";
import { useCan, useTeam } from "@/hooks/use-me";
import { ConversationList, type InboxTab } from "@/components/inbox/conversation-list";
import { ChatWindow } from "@/components/inbox/chat-window";
import { NewConversationDialog } from "@/components/inbox/new-conversation";
import { RobotIllustration } from "@/components/inbox/robot";

type ListResp = { items: ConversationListItem[]; counts: { all: number; unread: number; reply: number; ai: number } };

function Atendimento() {
  const router = useRouter();
  const sp = useSearchParams();
  const { me, isManager } = useCan();
  const { data: team } = useTeam();
  const [tab, setTab] = useState<InboxTab>(sp.get("aba") === "responder" ? "reply" : sp.get("aba") === "teo" ? "ai" : "all");
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [channelId, setChannelId] = useState("");
  const [assigned, setAssigned] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<string | null>(sp.get("conversa"));
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (sp.get("nova")) setNewOpen(true);
  }, [sp]);

  useEffect(() => {
    const t = setTimeout(() => setDeb(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: () => api<Channel[]>("/api/channels") });
  const { data, isLoading } = useQuery({
    queryKey: ["conversations", tab, deb, channelId, assigned, showClosed],
    queryFn: () => api<ListResp>(`/api/conversations${qs({ tab, q: deb, channelId, assignedToId: assigned, closed: showClosed ? 1 : undefined })}`),
    refetchInterval: 15_000,
  });

  // ?contato=ID abre a conversa mais recente daquele contato
  const contactParam = sp.get("contato");
  useEffect(() => {
    if (!contactParam) return;
    api<ListResp>(`/api/conversations${qs({ contactId: contactParam, closed: 1 })}`).then((r) => r.items[0] && setSelected(r.items[0].id));
  }, [contactParam]);
  useEffect(() => {
    const c = sp.get("conversa");
    if (c) setSelected(c);
  }, [sp]);

  const select = (id: string) => {
    setSelected(id);
    router.replace(`/atendimento?conversa=${id}`, { scroll: false });
  };
  const assistant = me?.assistantName ?? "Zeni";
  const brand = me?.agency.name ?? "Ápice";
  const company = channels?.find((c) => c.accountType === "COMPANY") ?? channels?.[0];

  return (
    <div className="flex h-app overflow-hidden">
      <div className={cn("h-full", selected ? "hidden md:block" : "block w-full md:w-auto")}>
        <ConversationList
          items={data?.items ?? []}
          counts={data?.counts}
          loading={isLoading}
          tab={tab}
          onTab={setTab}
          q={q}
          onQ={setQ}
          channels={channels ?? []}
          channelId={channelId}
          onChannel={setChannelId}
          selectedId={selected}
          onSelect={select}
          onNew={() => setNewOpen(true)}
          assistantName={assistant}
          team={team ?? []}
          assignedFilter={assigned}
          onAssignedFilter={setAssigned}
          showClosed={showClosed}
          onShowClosed={setShowClosed}
          canFilterUsers={isManager || me?.user.role === "ASSISTANT"}
        />
      </div>
      {selected ? (
        <ChatWindow key={selected} id={selected} team={team ?? []} assistantName={assistant} onBack={() => { setSelected(null); router.replace("/atendimento"); }} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-chat p-8 md:flex">
          <div className="relative animate-rise">
            <div className="absolute inset-0 -z-0 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <RobotIllustration className="relative h-40 w-48" />
          </div>
          <p className="eyebrow mt-4">{brand}</p>
          <h2 className="display mt-1 text-3xl">Central de atendimento</h2>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            {me?.seesOnlyOwn ? "Aqui ficam as suas conversas do WhatsApp." : "Todas as conversas dos números da empresa e dos corretores em um só lugar."} A {assistant} responde os novos leads na hora.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: MessageSquarePlus, label: "Nova conversa", hint: "Pelo WhatsApp", onClick: () => setNewOpen(true) },
              { icon: Inbox, label: "A responder", hint: "Fila de espera", badge: data?.counts.reply, onClick: () => setTab("reply") },
              { icon: Zap, label: `Com a ${assistant}`, hint: "Qualificando", badge: data?.counts.ai, onClick: () => setTab("ai") },
              { icon: Users, label: "Contatos", hint: "Ficha 360º", onClick: () => router.push("/contatos") },
            ].map((a, i) => (
              <button key={a.label} onClick={a.onClick} style={{ animationDelay: `${80 + i * 50}ms` }} className="card-hover relative flex h-32 w-36 animate-rise flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-3 text-center">
                <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary"><a.icon className="h-5 w-5" /></span>
                <span className="text-[13px] font-bold">{a.label}</span>
                <span className="text-[11px] text-muted-foreground">{a.hint}</span>
                {!!a.badge && <span className="absolute right-2.5 top-2.5 rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-primary-foreground">{a.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} channels={channels ?? []} onCreated={select} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Atendimento />
    </Suspense>
  );
}
