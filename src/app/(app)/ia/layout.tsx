"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MessageSquarePlus, Sparkles, Workflow, MessageSquare } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";

type Threads = { threads: { id: string; title: string; createdAt: string }[] };

function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: pend } = useQuery({ queryKey: ["teo-pendencias"], queryFn: () => api<{ total: number }>("/api/teo/pendencias"), refetchInterval: 60_000 });
  const { data: auto } = useQuery({ queryKey: ["teo-automations"], queryFn: () => api<{ items: { isEnabled: boolean }[] }>("/api/teo/automations") });
  const { data: threads } = useQuery({ queryKey: ["copilot-threads"], queryFn: () => api<Threads>("/api/teo/copilot") });
  const on = auto?.items.filter((i) => i.isEnabled).length ?? 0;
  const item = (active: boolean) => cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors", active ? "bg-primary/10 text-primary dark:text-secondary" : "text-foreground/75 hover:bg-muted");
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
      <div className="mb-4 flex items-center gap-3 px-1"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-primary text-primary-foreground shadow-md shadow-primary/25"><Sparkles className="h-5 w-5" /></span><span className="leading-tight"><span className="display block text-xl leading-none">{me?.assistantName ?? "Zeni"}</span><span className="text-[11px] font-semibold text-muted-foreground">Inteligência artificial</span></span></div>
      <button onClick={() => router.push(`/ia?thread=${Math.random().toString(36).slice(2, 10)}`)} className="mb-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-extrabold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-110">
        <MessageSquarePlus className="h-4 w-4" /> Nova conversa
      </button>
      <Link href="/ia/pendencias" className={item(pathname === "/ia/pendencias")}>
        <AlertTriangle className="h-4 w-4" /> <span className="flex-1">Pendências</span>
        {!!pend?.total && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-extrabold text-primary dark:text-secondary">{pend.total}</span>}
      </Link>
      <Link href="/ia/automacoes" className={item(pathname === "/ia/automacoes")}>
        <Workflow className="h-4 w-4" /> <span className="flex-1">Automações</span>
        {on > 0 ? <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">Ligado</span> : <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">Desligado</span>}
      </Link>
      {!!threads?.threads.length && (
        <>
          <p className="eyebrow mb-1.5 mt-6 px-3">Conversas recentes</p>
          <div className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
            {threads.threads.map((t) => (
              <Link key={t.id} href={`/ia?thread=${t.id}`} className={cn("flex items-center gap-2 truncate rounded-lg px-3 py-2 text-xs", sp.get("thread") === t.id ? "bg-muted font-bold" : "text-foreground/75 hover:bg-muted")}>
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> <span className="truncate">{t.title}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

export default function TeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-app">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
