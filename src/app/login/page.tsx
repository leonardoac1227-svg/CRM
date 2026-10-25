"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, MessageCircle, Search, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/client";

const DEMO = [
  { label: "Gestor", email: "gestor@horizonte.com.br" },
  { label: "Assistente", email: "assistente@horizonte.com.br" },
  { label: "Corretor", email: "corretor@horizonte.com.br" },
  { label: "Agência SEO", email: "agencia@rankalto.com.br" },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("gestor@horizonte.com.br");
  const [password, setPassword] = useState("teo123456");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email: override ?? email, password } });
      router.replace(sp.get("next") || "/getting-started");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-primary to-secondary p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" /> Téo CRM
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">Atendimento no WhatsApp com IA, funil de vendas e o ROI do seu SEO em um só lugar.</h2>
          <ul className="space-y-3 text-sm text-white/85">
            <li className="flex items-center gap-3"><MessageCircle className="h-4 w-4" /> O Téo qualifica cada lead em segundos e passa para o corretor certo.</li>
            <li className="flex items-center gap-3"><Search className="h-4 w-4" /> Saiba qual página do Google gerou cada conversa no WhatsApp.</li>
            <li className="flex items-center gap-3"><BarChart3 className="h-4 w-4" /> Campanhas oficiais da Meta com custo calculado antes de disparar.</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Téo CRM · White-Label para agências</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
          </div>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Senha">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>Entrar</Button>
          <div className="rounded-lg border bg-white p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Acesso de demonstração (senha teo123456)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <Button key={d.email} type="button" variant="outline" size="sm" onClick={() => { setEmail(d.email); submit(undefined, d.email); }}>
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
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
