"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, BarChart3, CalendarClock, CalendarDays, Clock, Megaphone, Sparkles, UserX, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { useMe } from "@/hooks/use-me";
import { Markdown } from "@/components/ui/markdown";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";

type Report = { title: string; markdown: string; actions: { label: string; href: string }[] };
type CopilotResp = { shortcuts: { key: string; label: string; description: string }[]; messages: { id: string; role: string; content: string }[]; llm: boolean };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "relatorio-corretores": BarChart3,
  "leads-sem-resposta": Clock,
  "tarefas-atrasadas": CalendarClock,
  "visitas-semana": CalendarDays,
  "leads-sem-responsavel": UserX,
  "criar-campanha": Megaphone,
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Copilot() {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [threadId, setThreadId] = useState<string>(() => sp.get("thread") ?? Math.random().toString(36).slice(2, 10));
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  useEffect(() => {
    const t = sp.get("thread");
    if (t && t !== threadId) setThreadId(t);
  }, [sp, threadId]);

  const { data } = useQuery({ queryKey: ["copilot", threadId], queryFn: () => api<CopilotResp>(`/api/teo/copilot?thread=${threadId}`) });
  const ask = useMutation({
    mutationFn: (p: { question?: string; shortcut?: string; label: string }) => {
      setPending(p.label);
      return api<Report>("/api/teo/copilot", { body: { threadId, question: p.question, shortcut: p.shortcut } });
    },
    onSettled: () => {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["copilot", threadId] });
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
      if (!sp.get("thread")) router.replace(`/teo?thread=${threadId}`, { scroll: false });
    },
  });

  // pergunta vinda do Ctrl+K: /teo?q=...
  useEffect(() => {
    const q = sp.get("q");
    if (q && !askedRef.current) {
      askedRef.current = true;
      ask.mutate({ question: q, label: q });
    }
  }, [sp, ask]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length, pending]);

  const messages = data?.messages ?? [];
  const empty = !messages.length && !pending;
  const assistant = me?.assistantName ?? "Téo";
  const submit = () => {
    const q = input.trim();
    if (!q || ask.isPending) return;
    setInput("");
    ask.mutate({ question: q, label: q });
  };

  return (
    <div className="mx-auto flex h-app max-w-4xl flex-col px-4">
      <div className="flex-1 overflow-y-auto py-8 scrollbar-thin">
        {empty ? (
          <div className="flex flex-col items-center pt-6 text-center md:pt-14">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg"><Sparkles className="h-7 w-7" /></span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{greeting()}, {me?.user.name.split(" ")[0]}. Em que posso ajudar?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pergunte qualquer coisa sobre seus leads, corretores, agenda e campanhas. Eu analiso os dados reais do CRM.</p>
            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data?.shortcuts.map((s) => {
                const Icon = ICONS[s.key] ?? Sparkles;
                return (
                  <button key={s.key} onClick={() => ask.mutate({ shortcut: s.key, label: s.label })} className="group flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"><Icon className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-sm font-semibold">{s.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{s.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((m) => {
              if (m.role === "user")
                return (
                  <div key={m.id} className="flex justify-end gap-3">
                    <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-white">{m.content}</p>
                    <Avatar name={me?.user.name} size={30} />
                  </div>
                );
              let r: Report;
              try {
                r = JSON.parse(m.content) as Report;
              } catch {
                r = { title: "", markdown: m.content, actions: [] };
              }
              return (
                <div key={m.id} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white"><Sparkles className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-white p-4 shadow-sm">
                    {r.title && <p className="mb-2 text-sm font-semibold">{r.title}</p>}
                    <Markdown text={r.markdown} />
                    {!!r.actions.length && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {r.actions.map((a) => <Button key={a.href} asChild size="xs" variant="soft"><Link href={a.href}>{a.label} →</Link></Button>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {pending && (
              <>
                <div className="flex justify-end gap-3">
                  <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-white">{pending}</p>
                  <Avatar name={me?.user.name} size={30} />
                </div>
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white"><Loader2 className="h-4 w-4 animate-spin" /></span>
                  <p className="flex items-center gap-1 rounded-2xl border bg-white px-4 py-3 text-sm text-muted-foreground">
                    {assistant} está analisando os dados
                    <span className="animate-typing">.</span><span className="animate-typing [animation-delay:0.2s]">.</span><span className="animate-typing [animation-delay:0.4s]">.</span>
                  </p>
                </div>
              </>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <div className="pb-5">
        {!empty && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {data?.shortcuts.map((s) => (
              <button key={s.key} onClick={() => ask.mutate({ shortcut: s.key, label: s.label })} className="shrink-0 rounded-full border bg-white px-3 py-1 text-xs text-slate-600 hover:border-primary/40 hover:text-primary">{s.label}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder={`Pergunte ao ${assistant}… ex.: "quais corretores estão com mais leads sem resposta?"`}
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <Button type="submit" size="icon" variant="ai" className="rounded-xl" disabled={!input.trim()} loading={ask.isPending}><ArrowUp className="h-4 w-4" /></Button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{data?.llm ? "Respostas geradas por IA com base nos dados do seu CRM." : "Relatórios calculados a partir dos dados do CRM (configure OPENAI_API_KEY ou GEMINI_API_KEY para perguntas livres com IA)."}</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Copilot />
    </Suspense>
  );
}
