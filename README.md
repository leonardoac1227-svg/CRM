# Ápice — CRM Omnichannel com IA no WhatsApp, Campanhas Meta e ROI de SEO

Plataforma SaaS **multi-tenant e white-label** (Agência de SEO → Empresas clientes) com:

- **Atendimento omnichannel** no WhatsApp: API Oficial da Meta (Cloud API) **e** Evolution API (QR Code), com regra da janela de 24h, modelos aprovados, mídia, áudio gravado no navegador e respostas rápidas.
- **Zeni ✨**, assistente de IA que responde novos leads na hora, faz as perguntas de qualificação (com regras **Se der** × **Obrigatória**), responde dúvidas frequentes, recomenda imóveis do catálogo, gera um **dossiê estruturado** na ficha do contato e distribui o lead pela **roleta de corretores**.
- **Funis** com visão de Análise (distribuição por etapa, matriz usuário × etapa, ranking de corretores) e **Kanban** com arrastar-e-soltar.
- **Campanhas** com modelos oficiais da Meta, injetor de variáveis com fallback inteligente, segmentação por funil/etapa/corretor/origem/etiqueta, teste A/B, agendamento, limite de horário e **custo estimado** (Marketing R$ 0,3217 · Utilidade R$ 0,035).
- **Rastreamento de SEO**: script `tracker.js` plug & play que detecta tráfego orgânico, guarda a página de entrada e injeta o protocolo `[Ref: #SEO-XXXX]` na mensagem do WhatsApp — o webhook vincula a conversa à página posicionada no Google.
- **RBAC** em 5 níveis: Super Admin, Agência SEO, Gestor, Assistente (permissões por módulo) e Corretor (só os próprios leads e chats).

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript, Tailwind CSS, componentes no estilo shadcn/ui (Radix), Lucide, TanStack Query, Zustand, `@hello-pangea/dnd`, cmdk |
| Backend | Route Handlers do Next em um **servidor Node customizado** (`server.ts`) com **Socket.io** (tempo real) e agendador de automações |
| Banco | PostgreSQL (compatível com Supabase) + Prisma ORM |
| IA | OpenAI (Structured Outputs / JSON Schema, Whisper, visão) ou Gemini — com **motor de regras pt-BR embutido** quando não há chave |
| WhatsApp | Adaptadores `META_OFFICIAL` (Graph API) e `EVOLUTION_QR` (Evolution API) atrás da mesma interface |

## Colocar no ar

O caminho completo, escrito para quem não é técnico, está em **[docs/COLOCAR-NO-AR.md](docs/COLOCAR-NO-AR.md)**:
banco no **Supabase**, servidor no **Render** (Blueprint `render.yaml`) e, opcionalmente, a
**Evolution API** para o WhatsApp por QR Code.

No primeiro start o Ápice cria sozinho a agência, a primeira empresa e a conta de administrador
a partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (sem senha definida, gera uma provisória e mostra nos logs).
Não há dados de demonstração: tudo começa vazio.

Depois do primeiro login, tudo é configurado pela interface, com assistentes passo a passo:

- **Clientes** (agência): cria cada empresa e o acesso do gestor, com senha provisória e convite pronto.
- **Integrações › WhatsApp**: API oficial da Meta (7 passos, com teste real das credenciais e da
  primeira mensagem) ou celular pelo QR Code (status ao vivo até conectar).
- **Site & SEO › Instalar o rastreio**: instruções para WordPress, Wix, Shopify, Google Tag Manager
  ou qualquer site, com verificação automática da instalação.
- **Integrações › Facebook / Google Ads / Portais**: endereço exclusivo, passo a passo e botão de lead de teste.

## Rodar localmente

Pré-requisitos: Node 20+ e PostgreSQL 14+ (ou `docker compose up db`).

```bash
cp .env.example .env          # DATABASE_URL, DIRECT_URL, JWT_SECRET e ADMIN_EMAIL
npm install
npm run db:push               # cria as tabelas
npm run db:seed               # agência + primeira empresa + administrador
npm run dev                   # http://localhost:3000
```

Produção: `npm run build && npm start`. Com Docker: `docker compose up --build` e depois
`docker compose exec app npx prisma db seed`.

> O servidor customizado é compilado com esbuild (`scripts/build-server.mjs`) porque o require-hook do Next não convive com loaders como o `tsx`.

## Variáveis de ambiente

Todas estão comentadas em `.env.example`. As principais:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Supabase: *Transaction pooler* (6543, com `?pgbouncer=true&connection_limit=1`) e *Session pooler* (5432) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Arquivos do chat no Supabase Storage (bucket criado automaticamente) |
| `JWT_SECRET` | Assinatura das sessões (≥ 32 caracteres) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `AGENCY_NAME` | Primeira conta, criada só com o banco vazio |
| `APP_URL` | Endereço público (no Render vem de `RENDER_EXTERNAL_URL`) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY`, `AI_PROVIDER` | Modo LLM da Zeni, transcrição de áudio e visão |
| `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` | Opcionais: o token é derivado do `JWT_SECRET` e a chave secreta pode ser cadastrada por número |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | Servidor da Evolution API (WhatsApp por QR Code) |
| `KEEPALIVE_URL` | Endereços que o servidor acessa a cada 10 min para mantê-los acordados |
| `DISABLE_SCHEDULER`, `CRON_SECRET` | Agendador interno ou `POST /api/cron/tick` em serverless |

## Arquitetura

```
server.ts                      Next + Socket.io + agendador (tick a cada 60 s)
prisma/schema.prisma           Modelo multi-tenant completo
prisma/bootstrap.ts            Primeira inicialização: agência, empresa e administrador
src/middleware.ts              Proteção de rotas (JWT em cookie httpOnly)
src/lib/
  auth.ts, session-token.ts    Sessão (jose/HS256), workspace ativo para agências
  rbac.ts                      Escopos por perfil (contactScope, conversationScope, taskScope…)
  api.ts                       Wrapper de rotas: sessão + RBAC por módulo + zod + serialização
  whatsapp/                    Adaptadores Meta Cloud API e Evolution API
  ai/
    teo-engine.ts              Motor de qualificação (LLM com Structured Outputs + regras pt-BR)
    extract.ts                 Extratores: dinheiro por extenso, CLT/autônomo, sim/não, anos…
    summary.ts                 Dossiê, faixa MCMV, poder de compra, temperatura do lead
    llm.ts                     OpenAI/Gemini, Whisper e visão
  services/
    messaging.ts               Envio (janela de 24h), recebimento, vínculo [Ref: #SEO-XXXX]
    ai-runner.ts               Orquestra a Zeni na conversa, transbordo e timeout
    distribution.ts            Roleta round-robin ponderada + aviso ao corretor no WhatsApp
    campaigns.ts               Segmentação, custo, envio em lotes, A/B, limite de horário
    analytics.ts               Funil, matriz, ranking, ROI de SEO
    copilot.ts                 Relatórios executivos do copiloto interno
    automations.ts             Lembrete de visita, pós-visita, follow-up, reengajamento, aniversários
  templates.ts                 Renderização de variáveis com fallback (cliente e servidor)
  tracker.ts                   Gerador do tracker.js
src/app/(app)/                 Telas autenticadas
src/app/api/                   API REST
```

### Endpoints públicos

| Rota | Função |
| --- | --- |
| `GET/POST /api/webhooks/meta` | Verificação e eventos da WhatsApp Cloud API (mensagens, status de entrega/leitura) |
| `POST /api/webhooks/evolution` | Mensagens, conexão e QR Code da Evolution API |
| `POST /api/webhooks/leads/:token` | Facebook Lead Ads (`field_data`), Google Ads (`user_column_data`), portais e JSON genérico |
| `GET /api/tracker.js?k=` | Script de rastreio do site |
| `POST /api/track/session · /event · /form` | Coleta do tracker (CORS aberto) |
| `POST /api/cron/tick` | Agendador para serverless (Bearer `CRON_SECRET`) |

### Motor da Zeni

A cada mensagem recebida em uma conversa com a IA ativa:

1. Mídia é pré-processada (áudio → Whisper; imagem/documento → visão), se habilitado.
2. **Modo LLM** (com chave): o modelo recebe o roteiro com o status de cada pergunta e devolve JSON validado (`replies`, `extracted`, perguntas respondidas/puladas, `wantsHuman`). As regras de obrigatoriedade são reforçadas no servidor (uma pergunta obrigatória só é pulada após 3 tentativas).
3. **Modo regras** (sem chave ou em falha do LLM): extratores pt-BR reconhecem “uns 4 mil e quinhentos”, “carteira assinada”, “sim, 6 anos”, “com minha esposa” etc.; dúvidas frequentes são detectadas por palavras-chave; perguntas **Se der** seguem adiante quando o cliente muda de assunto e **Obrigatórias** insistem educadamente.
4. Pedido de humano, fim do roteiro ou inatividade (`inactivityTimeoutHours`) disparam o transbordo: dossiê na ficha, mudança de etapa, atribuição (roleta / gestor / usuário fixo) e aviso ao corretor.

O drawer **Zeni → Automações → Atendimento no WhatsApp → Configurar** tem um simulador (“Testar conversa”) que roda o mesmo motor com a configuração ainda não salva.
