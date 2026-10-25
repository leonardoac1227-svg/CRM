"use client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client";
import { EMPLOYMENT_LABELS } from "@/lib/constants";
import { formatBRL, formatDate, formatPhone } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { OriginBadge, TagChip } from "@/components/shared/badges";

export function ContactSidePanel({ contactId, onClose, assistantName }: { contactId: string; onClose: () => void; assistantName: string }) {
  const openContact = useUi((s) => s.openContact);
  const { data: c } = useQuery({ queryKey: ["contact", contactId], queryFn: () => api<Contact & { activities: { id: string; title: string; createdAt: string }[] }>(`/api/contacts/${contactId}`) });
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l bg-white lg:flex">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">Ficha do contato</p>
        <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      {!c ? (
        <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-40" /></div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          <div className="flex flex-col items-center text-center">
            <Avatar name={c.name} size={56} />
            <p className="mt-2 font-semibold">{c.name ?? "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
            <div className="mt-2"><OriginBadge origin={c.origin} page={c.seoLandingPage} /></div>
            {!!c.tags.length && <div className="mt-2 flex flex-wrap justify-center gap-1">{c.tags.map((t) => <TagChip key={t} tag={t} />)}</div>}
          </div>
          {c.aiQualificationSummary && (
            <div className="rounded-lg bg-gradient-to-br from-primary/[0.05] to-secondary/[0.08] p-3 ring-1 ring-secondary/15">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-secondary"><Sparkles className="h-3.5 w-3.5" /> Qualificação do {assistantName}</p>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-700 scrollbar-thin">{c.aiQualificationSummary}</pre>
            </div>
          )}
          <div className="divide-y rounded-lg border px-3">
            {row("Renda", c.monthlyIncome !== null ? formatBRL(c.monthlyIncome) : null)}
            {row("Entrada", c.downPaymentAvailable !== null ? formatBRL(c.downPaymentAvailable) : null)}
            {row("FGTS", c.fgtsBalance ? formatBRL(c.fgtsBalance) : null)}
            {row("Trabalho", c.employmentType ? EMPLOYMENT_LABELS[c.employmentType] : null)}
            {row("Tempo de carteira", c.employmentYears)}
            {row("Imóvel no nome", c.hasProperty === null ? null : c.hasProperty ? "Sim" : "Não")}
            {row("Compra", c.buyingAlone)}
            {row("Valor do negócio", c.dealValue ? formatBRL(c.dealValue) : null)}
          </div>
          <div className="divide-y rounded-lg border px-3">
            {row("E-mail", c.email)}
            {row("Cidade", [c.city, c.state].filter(Boolean).join("/"))}
            {row("Bairro", c.neighborhood)}
            {row("Profissão", c.profession)}
            {row("Rastreio", c.trackingCode)}
            {row("Palavra-chave", c.seoKeyword)}
            {row("Criado em", formatDate(c.createdAt))}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => openContact(c.id)}><ExternalLink /> Abrir ficha completa</Button>
        </div>
      )}
    </aside>
  );
}
