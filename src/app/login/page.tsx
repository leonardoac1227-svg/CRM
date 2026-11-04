"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Search, Megaphone } from "lucide-react";
import { ApiceMark, ApiceWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/client";

const FEATURES = [
  { icon: Sparkles, title: "Zeni, a IA que atende por você", text: "Responde o lead na hora, qualifica e entrega ao corretor certo." },
  { icon: Search, title: "O ROI do seu SEO, provado", text: "Saiba qual página do Google gerou cada conversa no WhatsApp." },
  { icon: Megaphone, title: "Campanhas oficiais da Meta", text: "Disparos segmentados pelo funil, com custo calculado antes de enviar." },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email, password } });
      router.replace(sp.get("next") || "/central");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[rgb(201_163_91/0.16)] blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(201_163_91/0.09)_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <ApiceMark size={46} />
          <ApiceWordmark />
        </div>
        <div className="relative max-w-xl space-y-8">
          <h2 className="font-display text-[54px] font-semibold uppercase leading-[0.95] tracking-tight text-white">
            Do topo do Google <span className="text-gold">ao fechamento.</span>
          </h2>
          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <li key={f.text} className="flex animate-rise items-start gap-4" style={{ animationDelay: `${120 + i * 90}ms` }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(201_163_91/0.3)] bg-[rgb(201_163_91/0.1)] text-gold"><f.icon className="h-5 w-5" /></span>
                <span className="pt-0.5">
                  <span className="block text-[15px] font-bold text-white">{f.title}</span>
                  <span className="block text-sm text-sidebar-foreground">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">© {new Date().getFullYear()} Ápice by CRAP Digital · Especialistas em posicionamento no Google</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <ApiceMark size={40} />
            <span className="font-display text-2xl font-semibold tracking-[0.16em] text-primary dark:text-secondary">ÁPICE</span>
          </div>
          <div>
            <h1 className="display text-4xl leading-none">Entrar</h1>
            <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
          </div>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="h-11" />
          </Field>
          <Field label="Senha">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="h-11" />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Entrar no Ápice</Button>
          <p className="text-center text-xs text-muted-foreground">Esqueceu a senha? Peça ao gestor da sua empresa para gerar uma nova em Equipe.</p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
