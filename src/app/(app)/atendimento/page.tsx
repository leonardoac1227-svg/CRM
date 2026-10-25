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
import { ChatWindow, SimulateDialog } from "@/components/inbox/chat-window";
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
  const [simOpen, setSimOpen] = useState(false);

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
  const assistant = me?.assistantName ?? "Téo";
  const brand = me?.agency.name ?? "Téo CRM";
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
          <RobotIllustration className="h-40 w-48" />
          <h2 className="mt-4 text-xl font-semibold">Atendimento {brand}</h2>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            {me?.seesOnlyOwn ? "Aqui ficam as suas conversas do WhatsApp." : "Todas as conversas dos números da empresa e dos corretores em um só lugar."} O {assistant} responde os novos leads na hora.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: MessageSquarePlus, label: "Nova conversa", onClick: () => setNewOpen(true) },
              { icon: Inbox, label: "A responder", badge: data?.counts.reply, onClick: () => setTab("reply") },
              { icon: Zap, label: "Mensagens rápidas", onClick: () => (me?.demoMode && company ? setSimOpen(true) : router.push("/atendimento?aba=responder")) },
              { icon: Users, label: "Contatos", onClick: () => router.push("/contatos") },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick} className="relative flex h-28 w-32 flex-col items-center justify-center gap-2 rounded-xl border bg-white p-3 text-center text-xs font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><a.icon className="h-5 w-5" /></span>
                {a.label}
                {!!a.badge && <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">{a.badge}</span>}
              </button>
            ))}
          </div>
          {me?.demoMode && company && (
            <button onClick={() => setSimOpen(true)} className="mt-6 text-xs font-medium text-primary hover:underline">🧪 Simular um lead chegando pelo WhatsApp</button>
          )}
        </div>
      )}
      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} channels={channels ?? []} onCreated={select} />
      {company && <SimulateDialog open={simOpen} onOpenChange={setSimOpen} channelId={company.id} onDone={(r) => r.conversationId && select(r.conversationId)} />}
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
