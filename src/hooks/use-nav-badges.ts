"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { useMe } from "./use-me";
import type { BadgeKey } from "@/components/layout/nav-config";

type Pend = { total: number; items: { key: string; label: string; count: number; href: string }[] };
type Conv = { counts: { all: number; unread: number; reply: number; ai: number } };

/** Contadores ao vivo do menu: a responder, atrasadas, sem responsável, números e modelos com problema. */
export function useNavBadges() {
  const { data: me } = useMe();
  const has = (m: string) => !!me?.modules.includes(m);
  const pend = useQuery({
    queryKey: ["pendencias"],
    queryFn: () => api<Pend>("/api/teo/pendencias"),
    enabled: has("teo"),
    refetchInterval: 60_000,
  });
  const conv = useQuery({
    queryKey: ["conv-counts"],
    queryFn: () => api<Conv>("/api/conversations?tab=reply"),
    enabled: has("atendimento"),
    refetchInterval: 30_000,
  });
  const p = (k: string) => pend.data?.items.find((i) => i.key === k)?.count ?? 0;
  const badges: Record<BadgeKey, number> = {
    reply: conv.data?.counts.reply ?? 0,
    overdue: p("tarefas-atrasadas"),
    unassigned: p("leads-sem-responsavel"),
    attention: p("numeros"),
    rejected: p("modelos"),
    pendencias: pend.data?.total ?? 0,
  };
  return { badges, counts: conv.data?.counts, pendencias: pend.data };
}
