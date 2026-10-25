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
  const item = (active: boolean) => cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted");
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-white p-3 md:flex">
      <p className="mb-3 flex items-center gap-2 px-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-secondary" /> {me?.assistantName ?? "Téo"}</p>
      <button onClick={() => router.push(`/teo?thread=${Math.random().toString(36).slice(2, 10)}`)} className="mb-3 flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary to-secondary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95">
        <MessageSquarePlus className="h-4 w-4" /> Nova conversa
      </button>
      <Link href="/teo/pendencias" className={item(pathname === "/teo/pendencias")}>
        <AlertTriangle className="h-4 w-4" /> <span className="flex-1">Pendências</span>
        {!!pend?.total && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{pend.total}</span>}
      </Link>
      <Link href="/teo/automacoes" className={item(pathname === "/teo/automacoes")}>
        <Workflow className="h-4 w-4" /> <span className="flex-1">Automações</span>
        {on > 0 ? <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">Ligado</span> : <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">Desligado</span>}
      </Link>
      {!!threads?.threads.length && (
        <>
          <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recentes</p>
          <div className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
            {threads.threads.map((t) => (
              <Link key={t.id} href={`/teo?thread=${t.id}`} className={cn("flex items-center gap-2 truncate rounded-md px-3 py-1.5 text-xs", sp.get("thread") === t.id ? "bg-muted font-medium" : "text-slate-600 hover:bg-muted")}>
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
