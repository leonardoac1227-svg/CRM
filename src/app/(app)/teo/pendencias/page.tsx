"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { api } from "@/lib/client";
import { Card, PageHeader } from "@/components/ui/misc";

type Pend = { total: number; items: { key: string; label: string; count: number; href: string }[] };

export default function Pendencias() {
  const { data } = useQuery({ queryKey: ["teo-pendencias"], queryFn: () => api<Pend>("/api/teo/pendencias") });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Pendências" description="O que precisa da sua atenção agora, segundo o Téo." />
      <Card className="divide-y">
        {data?.items.map((i) => (
          <Link key={i.key} href={i.href} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50">
            {i.count > 0 ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
            <span className="flex-1 text-sm font-medium">{i.label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${i.count > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{i.count}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
