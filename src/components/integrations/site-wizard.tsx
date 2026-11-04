"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, Globe, Loader2, PartyPopper, Search, ShoppingBag, Tags, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { Callout, CopyField, ExtLink, Instructions, StepRail, Ui } from "./wizard-kit";

const STEPS = ["Seu site", "Onde ele foi feito", "Instalar o código", "Conferir"];

type Platform = "wordpress" | "wix" | "shopify" | "gtm" | "html" | "dev";
const PLATFORMS: { key: Platform; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "wordpress", label: "WordPress", hint: "Inclui Elementor, Divi e afins", icon: Globe },
  { key: "wix", label: "Wix", hint: "Precisa de plano Premium", icon: Globe },
  { key: "shopify", label: "Shopify", hint: "Lojas virtuais", icon: ShoppingBag },
  { key: "gtm", label: "Google Tag Manager", hint: "Se o site já usa o GTM", icon: Tags },
  { key: "html", label: "Outro / código próprio", hint: "Hostinger, Webflow, HTML…", icon: Code2 },
  { key: "dev", label: "Não sei / quem cuida é outra pessoa", hint: "Mandamos as instruções prontas", icon: Search },
];

type Verify = { siteUrl: string; reachable: boolean; inHtml: boolean; viaGtm: boolean; recentSessions: number; lastSession: { createdAt: string; landingPage: string } | null; installed: boolean; error: string | null };

function PlatformSteps({ p, snippet }: { p: Platform; snippet: string }) {
  if (p === "wordpress")
    return (
      <Instructions
        items={[
          <>Entre no painel do WordPress (normalmente <code>seusite.com.br/wp-admin</code>).</>,
          <>Vá em <Ui>Plugins</Ui> › <Ui>Adicionar novo</Ui>, procure <strong>WPCode</strong> (“Insert Headers and Footers”), clique em <Ui>Instalar agora</Ui> e depois em <Ui>Ativar</Ui>.</>,
          <>No menu da esquerda, abra <Ui>Code Snippets</Ui> › <Ui>Header &amp; Footer</Ui>.</>,
          <>Cole o código acima no campo <strong>Footer</strong> (rodapé) e clique em <Ui>Save Changes</Ui>.</>,
        ]}
      />
    );
  if (p === "wix")
    return (
      <Instructions
        items={[
          <>No painel do Wix, abra <Ui>Configurações</Ui> do site.</>,
          <>Role até <Ui>Avançado</Ui> › <Ui>Código personalizado</Ui> e clique em <Ui>+ Adicionar código</Ui>.</>,
          <>Cole o código, dê o nome <em>Ápice</em>, marque <Ui>Todas as páginas</Ui> e <Ui>Carregar uma vez</Ui>.</>,
          <>Em “Posicionar o código em”, escolha <Ui>Corpo - fim</Ui> e clique em <Ui>Aplicar</Ui>. Depois publique o site.</>,
        ]}
      />
    );
  if (p === "shopify")
    return (
      <Instructions
        items={[
          <>No admin da Shopify, vá em <Ui>Loja virtual</Ui> › <Ui>Temas</Ui>.</>,
          <>No tema atual, clique em <Ui>⋯</Ui> › <Ui>Editar código</Ui>.</>,
          <>Abra o arquivo <code>theme.liquid</code>, procure por <code>&lt;/body&gt;</code> e cole o código logo <strong>antes</strong> dele.</>,
          <>Clique em <Ui>Salvar</Ui>.</>,
        ]}
      />
    );
  if (p === "gtm")
    return (
      <Instructions
        items={[
          <>Abra o <ExtLink href="https://tagmanager.google.com">Google Tag Manager</ExtLink> e entre no contêiner do site.</>,
          <>Clique em <Ui>Tags</Ui> › <Ui>Nova</Ui> › <Ui>Configuração da tag</Ui> › <Ui>HTML personalizado</Ui>.</>,
          <>Cole o código e, em <Ui>Acionamento</Ui>, escolha <Ui>All Pages</Ui> (todas as páginas). Salve com o nome <em>Ápice</em>.</>,
          <>Clique em <Ui>Enviar</Ui> › <Ui>Publicar</Ui> no canto superior direito.</>,
        ]}
      />
    );
  if (p === "html")
    return (
      <Instructions
        items={[
          <>No editor do seu site, procure uma opção como <Ui>Código personalizado</Ui>, <Ui>Scripts</Ui>, <Ui>Integrações</Ui> ou <Ui>Rodapé / Footer</Ui>.</>,
          <>Cole o código para que ele apareça em <strong>todas as páginas</strong>, de preferência no fim da página (antes de <code>&lt;/body&gt;</code>).</>,
          <>Salve e publique o site.</>,
        ]}
      />
    );
  const msg = `Olá! Preciso instalar um código de rastreio no nosso site, em todas as páginas, antes do </body> (ou como tag "HTML personalizado" no Google Tag Manager, acionada em All Pages):\n\n${snippet}\n\nÉ só colar e publicar. Obrigado!`;
  return (
    <div className="space-y-3">
      <p className="text-[13.5px]">Sem problema! Copie a mensagem abaixo e envie para quem cuida do site (agência, desenvolvedor ou suporte da plataforma). Quando a pessoa instalar, volte aqui e confira.</p>
      <CopyField label="Mensagem pronta" value={msg} mono={false} />
    </div>
  );
}

/** Assistente que instala o rastreio de SEO no site do cliente, explicado para leigos. */
export function SiteWizard({ open, onOpenChange, snippet, trackerKey, initialSite }: { open: boolean; onOpenChange: (v: boolean) => void; snippet: string; trackerKey: string; initialSite: string | null }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [site, setSite] = useState(initialSite ?? "");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [button, setButton] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Verify | null>(null);
  const code = snippet.replace(`k=${trackerKey}`, `k=${trackerKey}${button ? "&button=1" : ""}`);

  // reinicia só quando o assistente abre (salvar o endereço do site atualiza initialSite)
  useEffect(() => {
    if (open) {
      setStep(0);
      setResult(null);
      setSite(initialSite ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function verify() {
    setChecking(true);
    try {
      const r = await api<Verify>("/api/seo/verify", { body: { siteUrl: site } });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["seo"] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  const body = [
    <div key="0" className="space-y-4">
      <p className="text-[15px] leading-relaxed">
        Com um pequeno código no site, o Ápice descobre <strong>de onde veio cada cliente</strong> (Google, anúncio, Instagram…) e <strong>qual página</strong> ele leu antes de chamar no WhatsApp.
        Assim você vê quanto o SEO está vendendo de verdade.
      </p>
      <Field label="Endereço do site" hint="Copie da barra do navegador quando estiver no site.">
        <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://www.suaempresa.com.br" inputMode="url" />
      </Field>
      <Callout>O código é leve, não deixa o site lento e não muda nada no visual — a não ser o botão de WhatsApp, se você quiser.</Callout>
    </div>,

    <div key="1" className="space-y-3">
      <p className="text-[15px]">Em qual plataforma o site foi feito?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setPlatform(p.key); setStep(2); }}
            className={cn("card-hover flex items-center gap-3 rounded-xl border bg-card p-4 text-left", platform === p.key && "border-primary")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-secondary"><p.icon className="h-5 w-5" /></span>
            <span>
              <span className="block text-[14px] font-extrabold">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>,

    <div key="2" className="space-y-4">
      <CopyField label="Seu código de rastreio" value={code} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={button} onChange={(e) => setButton(e.target.checked)} /> Mostrar um botão flutuante de WhatsApp no site (recomendado)</label>
      <p className="eyebrow pt-1">Como instalar {platform ? `no ${PLATFORMS.find((p) => p.key === platform)?.label}` : ""}</p>
      {platform && <PlatformSteps p={platform} snippet={code} />}
      <Callout tone="info" title="Os botões de WhatsApp que já existem no site continuam funcionando">
        O código detecta qualquer link para o WhatsApp (wa.me, api.whatsapp.com) e acrescenta um protocolo como <code>[Ref: #SEO-4821]</code> na mensagem. É isso que liga a conversa à página do Google.
      </Callout>
    </div>,

    <div key="3" className="space-y-4">
      <p className="text-[15px]">Vamos conferir. Abra o seu site em outra aba (isso registra uma visita) e clique em <strong>Verificar agora</strong>.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><a href={/^https?:/.test(site) ? site : `https://${site}`} target="_blank" rel="noreferrer"><Globe /> Abrir meu site</a></Button>
        <Button onClick={verify} loading={checking}><Search /> Verificar agora</Button>
      </div>
      {checking && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo o site e procurando o código…</p>}
      {result && (
        result.installed ? (
          <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-500/10 p-5">
            <PartyPopper className="h-8 w-8 shrink-0 text-emerald-600" />
            <div>
              <p className="display text-xl leading-none">Rastreio instalado!</p>
              <p className="mt-1.5 text-sm text-foreground/80">
                {result.inHtml ? "Encontramos o código no site. " : ""}
                {result.recentSessions ? `${result.recentSessions} visita(s) registrada(s) na última semana` : ""}
                {result.lastSession ? ` · a mais recente em ${formatDate(result.lastSession.createdAt, true)}.` : "."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-500/10 p-5">
              <XCircle className="h-7 w-7 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-extrabold">Ainda não encontramos o código</p>
                <p className="mt-1 text-foreground/80">{result.error ? `Motivo: ${result.error}. ` : ""}Confira os pontos abaixo e verifique de novo.</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-[13px] text-foreground/85">
              <li>• O site foi <strong>publicado</strong> depois de colar o código? Muitos editores só aplicam ao publicar.</li>
              <li>• Se o site tem cache (WP Rocket, LiteSpeed, Cloudflare), limpe o cache.</li>
              {result.viaGtm && <li>• Este site usa o Google Tag Manager: o código não aparece no HTML. Abra o site em outra aba e verifique de novo — vale a visita registrada.</li>}
              <li>• Bloqueadores de anúncio podem impedir o registro da sua visita; tente numa aba anônima ou no celular.</li>
            </ul>
          </div>
        )
      )}
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Instalar o rastreio no site" description={`Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}>
        <div className="border-b px-5 py-3"><StepRail steps={STEPS} current={step} onJump={setStep} /></div>
        <DialogBody className="min-h-[340px]"><div key={step} className="animate-rise">{body[step]}</div></DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}>{step === 0 ? "Fechar" : <><ArrowLeft /> Voltar</>}</Button>
          {step === 0 && <Button onClick={() => setStep(1)} disabled={site.trim().length < 4}>Próximo <ArrowRight /></Button>}
          {step === 1 && <Button variant="outline" disabled>Escolha uma opção</Button>}
          {step === 2 && <Button onClick={() => { setStep(3); void verify(); }}>Já instalei, conferir <ArrowRight /></Button>}
          {step === 3 && <Button onClick={() => onOpenChange(false)} variant={result?.installed ? "default" : "outline"}>{result?.installed ? <><CheckCircle2 /> Concluir</> : "Fechar e conferir depois"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
