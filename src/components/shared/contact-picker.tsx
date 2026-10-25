"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api, qs } from "@/lib/client";
import { formatPhone } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import { Input } from "@/components/ui/input";

export function ContactPicker({ value, onChange }: { value: { id: string; name: string | null } | null; onChange: (c: { id: string; name: string | null; phone?: string } | null) => void }) {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDeb(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useQuery({ queryKey: ["contacts", "picker", deb], queryFn: () => api<{ items: Contact[] }>(`/api/contacts${qs({ q: deb, pageSize: 8 })}`), enabled: deb.length >= 2 });
  if (value)
    return (
      <div className="flex h-9 items-center justify-between rounded-md border bg-white px-3 text-sm">
        {value.name ?? "Sem nome"}
        <button onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone…" />
      {!!data?.items.length && q.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          {data.items.map((c) => (
            <button key={c.id} onClick={() => { onChange({ id: c.id, name: c.name, phone: c.phone }); setQ(""); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-muted">
              <span>{c.name ?? "Sem nome"}</span>
              <span className="text-xs text-muted-foreground">{formatPhone(c.phone)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
