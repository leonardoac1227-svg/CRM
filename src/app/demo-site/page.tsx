"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

type Tracker = { touch: () => { origin: string; landingPage: string; code: string | null }; code: () => Promise<string | null> };

/** Site de exemplo (público) para testar o tracker.js de ponta a ponta. */
function DemoSite() {
  const sp = useSearchParams();
  const key = sp.get("k") ?? "";
  const [code, setCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [waText, setWaText] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [formOk, setFormOk] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      const tr = (window as unknown as { TeoTracker?: Tracker }).TeoTracker;
      if (!tr) return;
      clearInterval(t);
      setOrigin(tr.touch().origin);
      tr.code().then(setCode);
    }, 200);
    return () => clearInterval(t);
  }, []);

  function onWaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    try {
      const u = new URL(e.currentTarget.href);
      setWaText(u.searchParams.get("text"));
    } catch {}
  }

  async function simulateSend() {
    const channels = await fetch("/api/channels").then((r) => (r.ok ? r.json() : []));
    const company = (channels as { id: string; accountType: string }[]).find((c) => c.accountType === "COMPANY");
    if (!company || !waText) return alert("Faça login no CRM nesta mesma janela para simular o envio.");
    const phone = `5575${Math.floor(900000000 + Math.random() * 99999999)}`;
    const r = await fetch(`/api/channels/${company.id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: phone, name: "Visitante do Site", text: waText }) });
    if (r.ok) setSent(true);
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {key && <Script src={`/api/tracker.js?k=${key}`} strategy="afterInteractive" />}
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-lg font-bold text-emerald-700">🏡 Horizonte Imóveis</p>
          <nav className="hidden gap-6 text-sm text-slate-600 sm:flex"><span>Comprar</span><span>Alugar</span><span>Blog</span><span>Contato</span></nav>
        </div>
      </header>
      <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-900">
        Site de demonstração do tracker · origem detectada: <strong>{origin || "…"}</strong> · protocolo: <strong>{code ? `#${code}` : "gerando…"}</strong>
      </div>
      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[1fr_320px]">
        <article>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Blog · Financiamento</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Minha Casa Minha Vida em Feira de Santana: guia completo 2026</h1>
          <p className="mt-4 text-slate-600">Descubra quem tem direito, quanto de renda é preciso, como usar o FGTS na entrada e quais bairros têm as melhores opções de apartamentos de 2 quartos com subsídio.</p>
          <h2 className="mt-8 text-xl font-semibold">Quem pode participar?</h2>
          <p className="mt-2 text-slate-600">Famílias com renda bruta de até R$ 12 mil podem financiar pelo programa, com taxas reduzidas e subsídio que pode passar de R$ 50 mil nas faixas 1 e 2.</p>
          <a href="https://wa.me/5575998001000?text=Ol%C3%A1!%20Li%20o%20artigo%20sobre%20MCMV%20e%20quero%20saber%20se%20me%20encaixo." onClick={onWaClick} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white shadow-lg hover:brightness-95">
            💬 Falar no WhatsApp
          </a>
          {waText && (
            <div className="mt-6 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-800">Mensagem que abriria no WhatsApp do cliente:</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{waText}</pre>
              {sent ? <p className="mt-3 text-sm font-semibold text-emerald-700">✅ Enviado! Abra o Atendimento no CRM: o Téo já respondeu e o lead está vinculado a esta página.</p> : <button onClick={simulateSend} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Simular envio para o CRM</button>}
            </div>
          )}
        </article>
        <aside className="h-fit rounded-xl border p-5 shadow-sm">
          <p className="font-semibold">Faça uma simulação grátis</p>
          {formOk ? (
            <p className="mt-3 text-sm text-emerald-700">Recebemos seus dados! O lead foi criado no CRM com a origem SEO completa.</p>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); setTimeout(() => setFormOk(true), 300); }}>
              <input name="nome" placeholder="Seu nome" required className="w-full rounded-md border px-3 py-2 text-sm" />
              <input name="whatsapp" type="tel" placeholder="WhatsApp com DDD" required className="w-full rounded-md border px-3 py-2 text-sm" />
              <input name="email" type="email" placeholder="E-mail" className="w-full rounded-md border px-3 py-2 text-sm" />
              <button className="w-full rounded-md bg-emerald-700 py-2 text-sm font-semibold text-white">Quero simular</button>
            </form>
          )}
        </aside>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <DemoSite />
    </Suspense>
  );
}
