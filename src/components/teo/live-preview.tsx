"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Play, RotateCcw, Send, Sparkles, FileText } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { AiConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";

type SimMsg = { from: "contact" | "assistant"; text: string };
type SimResp = { replies: string[]; state: unknown; handoff: string | null; summary: string | null; mode: "llm" | "rules"; usedFaq: string | null; llm: boolean };

export function engineConfig(c: AiConfig) {
  return {
    ...c,
    questions: c.questions.map((q, i) => ({ id: q.id ?? `q${i}`, order: i + 1, questionText: q.questionText, requirementMode: q.requirementMode, targetField: q.targetField })),
    faqs: c.faqs.map((f, i) => ({ id: f.id ?? `f${i}`, questionTitle: f.questionTitle, answerText: f.answerText, keywords: f.keywords, isEnabled: f.isEnabled })),
  };
}

function renderGreetingPreview(c: AiConfig, company: string) {
  return c.initialGreeting
    .replace(/\{\{\s*nome_assistente\s*\}\}/g, c.assistantName)
    .replace(/\{\{\s*nome_empresa\s*\}\}/g, company)
    .replace(/\{\{\s*cidade\s*\}\}/g, c.regionCity ?? "")
    .replace(/[ \t]*\{\{\s*nome_cliente\s*\}\}/g, " Ana")
    .replace(/\s+([,!?.])/g, "$1");
}

export function LivePreview({ config, company }: { config: AiConfig; company: string }) {
  const [testing, setTesting] = useState(false);
  const [msgs, setMsgs] = useState<SimMsg[]>([]);
  const [state, setState] = useState<unknown>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [mode, setMode] = useState<"llm" | "rules" | null>(null);
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs.length, loading]);

  async function turn(incoming: string | null, hist: SimMsg[], st: unknown, display: SimMsg[]) {
    setLoading(true);
    try {
      const r = await api<SimResp>("/api/teo/simulate", {
        body: { config: engineConfig(config), state: st, history: hist.map((m) => ({ from: m.from, text: m.text })), incoming, mode: "auto" },
      });
      // efeito "digitando" entre mensagens curtas
      let acc = display;
      for (const [i, text] of r.replies.entries()) {
        if (i > 0) await new Promise((res) => setTimeout(res, 450));
        acc = [...acc, { from: "assistant", text }];
        setMsgs(acc);
      }
      setState(r.state);
      setMode(r.mode);
      if (r.handoff) {
        setDone(true);
        setSummary(r.summary);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setTesting(true);
    setMsgs([]);
    setState(null);
    setSummary(null);
    setDone(false);
    const first: SimMsg[] = [{ from: "contact", text: "Oi! Vi o anúncio de vocês e queria mais informações." }];
    setMsgs(first);
    turn(first[0].text, [], null, first);
  }

  function send() {
    const t = input.trim();
    if (!t || loading || done) return;
    setInput("");
    const hist: SimMsg[] = [...msgs, { from: "contact", text: t }];
    setMsgs(hist);
    turn(t, msgs, state, hist);
  }

  const q1 = config.questions[0]?.questionText;
  const staticPreview: SimMsg[] = [
    { from: "contact", text: "Oi! Vi o anúncio de vocês e queria mais informações." },
    { from: "assistant", text: renderGreetingPreview(config, company) },
    ...(q1 ? [{ from: "assistant" as const, text: q1 }] : []),
  ];
  const list = testing ? msgs : staticPreview;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-secondary" /> Como o {config.assistantName || "Téo"} vai falar</p>
          <p className="text-[11px] text-muted-foreground">{testing ? (mode === "llm" ? "Modo IA (LLM) · usa a configuração atual, sem salvar" : "Motor de regras embutido · usa a configuração atual, sem salvar") : "Prévia com a configuração atual"}</p>
        </div>
        {testing ? (
          <Button size="xs" variant="outline" onClick={start}><RotateCcw /> Reiniciar</Button>
        ) : (
          <Button size="xs" variant="ai" onClick={start}><Play /> Testar conversa</Button>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-chat p-4 scrollbar-thin">
        {list.map((m, i) => (
          <div key={i} className={cn("flex", m.from === "contact" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-[13px] shadow-sm", m.from === "contact" ? "rounded-tl-sm bg-white" : "rounded-tr-sm bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-secondary/15")}>
              {m.from === "assistant" && <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-secondary"><Bot className="h-3 w-3" /> 🤖 IA: {config.assistantName}</p>}
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="flex gap-1 rounded-2xl bg-white px-3 py-3 shadow-sm">
              <span className="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400" />
              <span className="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400 [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400 [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        {summary && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-800"><FileText className="h-3.5 w-3.5" /> Relatório que o corretor receberia</p>
            <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-emerald-900">{summary}</pre>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {testing && (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t bg-white p-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} disabled={done} placeholder={done ? "Conversa transferida para o corretor" : "Responda como se fosse o cliente…"} className="h-9 flex-1 rounded-full border bg-slate-50 px-4 text-sm outline-none focus:border-primary/50 disabled:opacity-60" />
          <Button size="icon" className="rounded-full" disabled={!input.trim() || done} loading={loading}><Send className="h-4 w-4" /></Button>
        </form>
      )}
    </div>
  );
}
