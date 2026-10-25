"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BedDouble, Building2, MapPin, Plus, Ruler, Search, Trash2, Users } from "lucide-react";
import { api, qs } from "@/lib/client";
import { CATALOG_STATUS_LABELS } from "@/lib/constants";
import { formatBRL } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

const EMPTY = { title: "", code: "", category: "Apartamento", price: "", neighborhood: "", city: "", bedrooms: "", areaM2: "", description: "", images: "", status: "AVAILABLE" };
const TONE = { AVAILABLE: "green", RESERVED: "amber", SOLD: "slate", RENTED: "blue", INACTIVE: "slate" } as const;

function ItemDialog({ open, onOpenChange, item, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; item: CatalogItem | null; onSaved: () => void }) {
  const [f, setF] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(item ? { ...EMPTY, ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v === null ? "" : Array.isArray(v) ? v.join("\n") : String(v)])) } : EMPTY);
  }, [open, item]);
  const s = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setLoading(true);
    try {
      const body = {
        title: f.title, code: f.code, category: f.category, status: f.status, neighborhood: f.neighborhood || null, city: f.city || null, description: f.description || null,
        price: f.price ? Number(f.price.replace(/\./g, "").replace(",", ".")) : null, bedrooms: f.bedrooms ? Number(f.bedrooms) : null, areaM2: f.areaM2 ? Number(f.areaM2) : null,
        images: f.images.split(/\s+/).filter((u) => /^https?:\/\//.test(u)),
      };
      if (item) await api(`/api/catalog/${item.id}`, { method: "PATCH", body });
      else await api("/api/catalog", { body });
      toast.success("Imóvel salvo");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? "Editar imóvel" : "Cadastrar imóvel"} size="lg">
        <DialogBody className="grid gap-3 sm:grid-cols-3">
          <Field label="Título" className="sm:col-span-2"><Input value={f.title} onChange={s("title")} placeholder="Apartamento 2/4 no Santa Mônica" /></Field>
          <Field label="Código"><Input value={f.code} onChange={s("code")} placeholder="AP-201" /></Field>
          <Field label="Categoria">
            <Select value={f.category} onChange={s("category")}>{["Apartamento", "Casa", "Lançamento", "Cobertura", "Terreno", "Comercial", "Locação", "Serviço"].map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Preço (R$)"><Input value={f.price} onChange={s("price")} inputMode="decimal" /></Field>
          <Field label="Status"><Select value={f.status} onChange={s("status")}>{Object.entries(CATALOG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Bairro"><Input value={f.neighborhood} onChange={s("neighborhood")} /></Field>
          <Field label="Cidade"><Input value={f.city} onChange={s("city")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quartos"><Input type="number" value={f.bedrooms} onChange={s("bedrooms")} /></Field>
            <Field label="Área (m²)"><Input type="number" value={f.areaM2} onChange={s("areaM2")} /></Field>
          </div>
          <Field label="Descrição" className="sm:col-span-3"><Textarea rows={3} value={f.description} onChange={s("description")} /></Field>
          <Field label="Fotos (uma URL por linha)" className="sm:col-span-3"><Textarea rows={2} value={f.images} onChange={s("images")} placeholder="https://…" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={f.title.length < 2 || !f.code}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Imoveis() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["catalog", q, status, category], queryFn: () => api<CatalogItem[]>(`/api/catalog${qs({ q, status, category })}`) });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/catalog/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog"] }) });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Imóveis" description="Catálogo usado pela equipe e pelo Téo para recomendar opções aos clientes." actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Cadastrar imóvel</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, código ou bairro" className="pl-8" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto"><option value="">Todas as categorias</option>{["Apartamento", "Casa", "Lançamento", "Cobertura", "Terreno", "Comercial", "Locação"].map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">Todos os status</option>{Object.entries(CATALOG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        {data?.map((i) => (
          <Card key={i.id} className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md" onClick={() => { setEditing(i); setOpen(true); }}>
            <div className="relative h-40 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.images[0] ? <img src={i.images[0]} alt={i.title} className="h-full w-full object-cover" /> : <Building2 className="m-auto h-full w-10 text-slate-300" />}
              <Badge tone={TONE[i.status]} className="absolute left-2 top-2 bg-white/95">{CATALOG_STATUS_LABELS[i.status]}</Badge>
              <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">{i.code}</span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold">{i.title}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {i.neighborhood}{i.city ? `, ${i.city}` : ""}</p>
              <p className="mt-2 text-base font-semibold text-primary">{i.price ? formatBRL(i.price) : "Consulte"}{i.category === "Locação" || i.category === "Comercial" ? <span className="text-xs font-normal text-muted-foreground">/mês</span> : null}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                {i.bedrooms ? <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {i.bedrooms}</span> : null}
                {i.areaM2 ? <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {i.areaM2} m²</span> : null}
                <span className="flex items-center gap-1" title="Leads interessados"><Users className="h-3.5 w-3.5" /> {i._count?.interestedContacts ?? 0}</span>
                <button onClick={(e) => { e.stopPropagation(); if (confirm("Excluir imóvel?")) del.mutate(i.id); }} className="ml-auto opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {data && !data.length && <EmptyState icon={<Building2 className="h-5 w-5" />} title="Nenhum imóvel" description="Cadastre o primeiro imóvel ou serviço." action={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Cadastrar</Button>} />}
      <ItemDialog open={open} onOpenChange={setOpen} item={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["catalog"] })} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Imoveis />
    </Suspense>
  );
}
