# Téo CRM — CRM Omnichannel com IA no WhatsApp, Campanhas Meta e ROI de SEO

Plataforma SaaS **multi-tenant e white-label** (Agência de SEO → Empresas clientes) com:

- **Atendimento omnichannel** no WhatsApp: API Oficial da Meta (Cloud API) **e** Evolution API (QR Code), com regra da janela de 24h, modelos aprovados, mídia, áudio gravado no navegador e respostas rápidas.
- **Téo ✨**, assistente de IA que responde novos leads na hora, faz as perguntas de qualificação (com regras **Se der** × **Obrigatória**), responde dúvidas frequentes, recomenda imóveis do catálogo, gera um **dossiê estruturado** na ficha do contato e distribui o lead pela **roleta de corretores**.
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

## Deploy gratuito (Render)

O arquivo `render.yaml` cria tudo no plano gratuito do Render: o web service e um PostgreSQL.

1. Crie uma conta em [render.com](https://render.com) entrando com o GitHub.
2. **New → Blueprint** → escolha o repositório `CRM` (branch `claude/focused-heisenberg-wo4i29`) → **Apply**.
3. Quando pedir `GEMINI_API_KEY`, cole uma chave gratuita do [Google AI Studio](https://aistudio.google.com/apikey) ou deixe em branco (o Téo usa o motor de regras).
4. Aguarde o build (~5 min) e abra a URL `https://teo-crm-xxxx.onrender.com`. O banco é populado com os dados de demonstração no primeiro start.

Limites do plano gratuito: o serviço "dorme" após 15 min sem acesso (o primeiro acesso depois disso leva ~1 min), o PostgreSQL gratuito expira em 30 dias e arquivos enviados no chat não são permanentes.

## Como rodar

Pré-requisitos: Node 20+, PostgreSQL 14+ (ou `docker compose up db`).

```bash
cp .env.example .env          # ajuste DATABASE_URL / DIRECT_URL / JWT_SECRET
npm install
npm run db:push               # cria as tabelas
npm run db:seed               # dados de demonstração
npm run dev                   # http://localhost:3000
```

Produção:

```bash
npm run build                 # next build + bundle do servidor (dist/server.js)
npm start
```

Com Docker: `docker compose up --build` (sobe Postgres + app). Rode o seed uma vez com
`docker compose exec app npx prisma db seed`.

> O servidor customizado é compilado com esbuild (`scripts/build-server.mjs`) porque o require-hook do Next não convive com loaders como o `tsx`.

### Contas de demonstração (senha `teo123456`)

| Perfil | E-mail | O que vê |
| --- | --- | --- |
| Gestor | `gestor@horizonte.com.br` | Tudo, inclusive conversas dos números dos corretores |
| Assistente | `assistente@horizonte.com.br` | Módulos liberados em Equipe → Permissões |
| Corretor | `corretor@horizonte.com.br` / `marcio@horizonte.com.br` | Apenas os próprios leads, chats e agenda |
| Agência SEO | `agencia@rankalto.com.br` | Alterna entre os workspaces (clientes) da agência |

Com `DEMO_MODE=true`, o menu do avatar permite **trocar de perfil sem senha** e o Atendimento ganha o botão **“Simular mensagem do cliente”**, que passa pelo mesmo pipeline do webhook (lead novo → rastreio SEO → Téo → roleta).

### Testar o tracker de ponta a ponta

1. Acesse **Mais → Site & SEO** e clique em **“Testar em um site de exemplo”** (`/demo-site`).
2. O site de exemplo carrega o `tracker.js`, detecta a origem (com `utm_medium=organic` simula o Google) e gera o protocolo.
3. Clique em **Falar no WhatsApp → Simular envio para o CRM**: o lead aparece no Atendimento já atendido pelo Téo e vinculado à página do blog. O formulário lateral cria o lead com a mesma atribuição.

## Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL (no Supabase: pooler em `DATABASE_URL`, conexão direta em `DIRECT_URL`) |
| `JWT_SECRET` | Assinatura das sessões (obrigatório em produção, ≥ 32 caracteres) |
| `APP_URL` | URL pública (usada no `tracker.js`, uploads e webhooks) |
| `DEMO_MODE` | Troca de perfil sem senha e simulador de mensagens |
| `OPENAI_API_KEY` / `GEMINI_API_KEY`, `AI_PROVIDER` | Liga o modo LLM do Téo, transcrição de áudio e análise de imagem |
| `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` | Verificação e assinatura (`X-Hub-Signature-256`) do webhook da Meta |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | Evolution API padrão (cada número também pode ter a sua) |
| `DISABLE_SCHEDULER`, `CRON_SECRET` | Agendador interno ou `POST /api/cron/tick` em ambientes serverless |

Canais com token iniciado por `demo` (ou Evolution sem URL/chave) operam em **modo simulado**: as mensagens são registradas normalmente, sem chamar o provedor.

## Arquitetura

```
server.ts                      Next + Socket.io + agendador (tick a cada 60 s)
prisma/schema.prisma           Modelo multi-tenant completo
prisma/seed.ts                 Workspace de demonstração (Horizonte Imóveis / Rank Alto SEO)
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
    ai-runner.ts               Orquestra o Téo na conversa, transbordo e timeout
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

### Motor do Téo

A cada mensagem recebida em uma conversa com a IA ativa:

1. Mídia é pré-processada (áudio → Whisper; imagem/documento → visão), se habilitado.
2. **Modo LLM** (com chave): o modelo recebe o roteiro com o status de cada pergunta e devolve JSON validado (`replies`, `extracted`, perguntas respondidas/puladas, `wantsHuman`). As regras de obrigatoriedade são reforçadas no servidor (uma pergunta obrigatória só é pulada após 3 tentativas).
3. **Modo regras** (sem chave ou em falha do LLM): extratores pt-BR reconhecem “uns 4 mil e quinhentos”, “carteira assinada”, “sim, 6 anos”, “com minha esposa” etc.; dúvidas frequentes são detectadas por palavras-chave; perguntas **Se der** seguem adiante quando o cliente muda de assunto e **Obrigatórias** insistem educadamente.
4. Pedido de humano, fim do roteiro ou inatividade (`inactivityTimeoutHours`) disparam o transbordo: dossiê na ficha, mudança de etapa, atribuição (roleta / gestor / usuário fixo) e aviso ao corretor.

O drawer **Téo → Automações → Atendimento no WhatsApp → Configurar** tem um simulador (“Testar conversa”) que roda o mesmo motor com a configuração ainda não salva.
