# Guia de Funcionalidades — Ápice

> **Sobre este guia.** O Ápice ainda é um **projeto de demonstração**: os dados vêm do seed
> (imobiliária fictícia *Horizonte Imóveis*, agência fictícia *CRAP Digital*) e as integrações
> externas rodam em **modo simulado**. Este documento descreve **o comportamento esperado** de
> cada funcionalidade — o que o sistema foi construído para fazer — e, no fim, o que já funciona
> de ponta a ponta na demo e o que depende de credenciais reais.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Perfis de acesso (RBAC)](#2-perfis-de-acesso-rbac)
3. [Navegação e recursos globais](#3-navegação-e-recursos-globais)
4. [Onde começar (onboarding)](#4-onde-começar-onboarding)
5. [Atendimento (inbox omnichannel)](#5-atendimento-inbox-omnichannel)
6. [Zeni ✨ — o assistente de IA](#6-téo---o-assistente-de-ia)
7. [Contatos](#7-contatos)
8. [Funis (Análise e Kanban)](#8-funis-análise-e-kanban)
9. [Campanhas, Modelos e Formulários](#9-campanhas-modelos-e-formulários)
10. [Imóveis (catálogo)](#10-imóveis-catálogo)
11. [Agenda (tarefas)](#11-agenda-tarefas)
12. [Relatórios](#12-relatórios)
13. [Site & SEO (rastreamento e white-label)](#13-site--seo-rastreamento-e-white-label)
14. [Integrações](#14-integrações)
15. [Equipe e roleta de distribuição](#15-equipe-e-roleta-de-distribuição)
16. [Notificações](#16-notificações)
17. [Fluxos de ponta a ponta](#17-fluxos-de-ponta-a-ponta)
18. [Endpoints públicos e API](#18-endpoints-públicos-e-api)
19. [O que é simulado × o que fica real com credenciais](#19-o-que-é-simulado--o-que-fica-real-com-credenciais)
20. [Dados e contas de demonstração](#20-dados-e-contas-de-demonstração)

---

## 1. Visão geral

O Ápice é um **CRM SaaS multi-tenant e white-label** pensado para uma **agência de SEO** que
revende o sistema para seus **clientes** (imobiliárias, clínicas, prestadores de serviço). A
hierarquia é:

```
Agência (marca, cores, domínio)
 └── Workspaces (cada empresa cliente: nicho, cidade, funis, equipe, números…)
      └── Usuários (Gestor, Assistente, Corretor)
```

Os quatro pilares do produto:

| Pilar | Em uma frase |
| --- | --- |
| **Atendimento no WhatsApp** | Todas as conversas (número oficial da empresa + WhatsApp de cada corretor) numa só caixa de entrada. |
| **Zeni ✨ (IA)** | Responde o lead na hora, faz as perguntas de qualificação, gera um dossiê e entrega ao corretor certo. |
| **Funil e campanhas** | Kanban de vendas, análises por etapa/corretor e disparos oficiais da Meta com custo calculado. |
| **ROI do SEO** | Um script no site descobre qual página do Google gerou cada conversa — e quanto ela vendeu. |

Nichos suportados no cadastro do workspace: Imobiliário, Serviços, Clínica, E-commerce e Outros
(o conteúdo padrão — perguntas, FAQs, catálogo — é voltado ao mercado imobiliário).

---

## 2. Perfis de acesso (RBAC)

São 5 perfis. Toda rota da API verifica o perfil e o módulo antes de responder.

| Perfil | O que pode fazer |
| --- | --- |
| **Super Admin** | Acesso total à plataforma. |
| **Agência SEO** | Acesso total e **alterna entre os workspaces** (clientes) da agência; edita a marca white-label. |
| **Gestor** | Acesso total ao workspace: vê todos os leads, todas as conversas (inclusive dos números dos corretores), configura a Zeni, a equipe e as integrações. |
| **Assistente** | Acesso **por módulo**, ligado/desligado pelo gestor em *Equipe → Permissões*. Pode ou não “ver leads de toda a equipe”. |
| **Corretor** | Vê **apenas os próprios** leads, conversas (atribuídas a ele ou do número dele) e tarefas. Módulos: Atendimento, Contatos, Funis, Imóveis, Agenda e Zeni. |

Permissões padrão do Assistente: Atendimento, Contatos, Funis, Imóveis, Agenda, Zeni e Campanhas
**ligados**; Relatórios, Site & SEO, Integrações e Equipe **desligados**; “ver todos os leads” ligado.

Ao abrir um módulo sem permissão, a tela mostra *“Seu perfil não tem acesso a este módulo — peça
ao gestor para liberar o acesso em Equipe”*.

Ações restritas a gestores (exemplos): reatribuir conversas, configurar automações, convidar/
desativar membros, editar a roleta.

---

## 3. Navegação e recursos globais

**Menu lateral (sidebar)**
- Sempre visível no computador, com **todos os módulos à mostra**, agrupados em *Início*, *Vender*,
  *Crescer*, *Zeni · IA* e *Configurar* (só aparecem os módulos liberados para o perfil).
- **Contadores ao vivo** ao lado de cada item: conversas a responder, tarefas atrasadas, leads sem
  responsável, números que pedem atenção, modelos rejeitados e pendências da Zeni.
- Cartão da empresa (workspace) ativa, atalho de busca, status “Zeni está ativa” e o usuário logado.
- Pode ser **recolhido** para uma coluna de ícones (com dicas ao passar o mouse); no celular vira uma
  gaveta aberta pelo botão de menu.

**Barra superior**
- Mostra onde você está (grupo › tela), a busca, **“Perguntar à Zeni”** e o botão **Criar**
  (nova conversa, contato, tarefa, imóvel ou campanha a partir de qualquer tela).
- **Tema claro/escuro** (escuro é o padrão; a escolha fica salva no navegador).
- **Sino de notificações**, ajuda (primeiros passos e tour) e **menu do avatar**: troca de cliente
  (perfil Agência), troca de tema, sair e, no modo demonstração, **“Testar visão como…”**.

**Central (`/central`) — a tela inicial**
- Saudação com o resumo das pendências, campo para **perguntar à Zeni** com atalhos prontos e
  indicadores do dia (a responder, com a Zeni, leads e vendas da semana, visitas).
- **“Tudo o que o Ápice faz”**: um cartão por módulo com o que ele faz e um dado ao vivo.
- Painéis: quem está esperando resposta, o funil padrão, a agenda de hoje e o que a Zeni sinalizou.

**Busca global — `Ctrl+K`**
- Pesquisa contatos, conversas, imóveis (por código) e tarefas ao mesmo tempo.
- Atalhos para todas as telas, com a descrição de cada uma.
- **“Perguntar à Zeni”**: envia o texto digitado direto para o copiloto.

**Tempo real**
- Socket.io avisa a interface sobre mensagens novas, mudanças de conversa e notificações; as
  listas também se atualizam periodicamente.

**Identidade visual**
- Marca **Ápice by CRAP Digital**: fundo preto-azulado, dourado como cor de destaque, títulos em
  Oswald (caixa alta) e textos em Manrope. O dourado é o padrão do white-label: cada agência pode
  trocar as cores em *Site & SEO → Configuração White-Label*.

**Login**
- E-mail e senha com sessão JWT em cookie httpOnly. A tela de login lista as contas de
  demonstração (senha `teo123456`).

---

## 4. Onde começar (onboarding)

Página `/getting-started`:

- **Checklist de primeiros passos** com barra de progresso (5 etapas):
  1. Conectar WhatsApp → *Integrações*
  2. Cadastrar o primeiro imóvel/serviço → *Imóveis*
  3. Convidar a equipe → *Equipe*
  4. Criar um contato → *Contatos*
  5. Configurar o site (Script SEO) → *Site & SEO*
- **Vídeo de boas-vindas** (espaço reservado).
- **Passeio guiado** (“tour”) em slides que apresenta Atendimento, Zeni, Funis, Campanhas e Site & SEO.

---

## 5. Atendimento (inbox omnichannel)

Página `/atendimento`. É a tela principal do dia a dia.

### Lista de conversas
- Abas: **Todas**, **Não lidos**, **A responder** e **Com a Zeni** (com contadores).
- Busca por nome, telefone ou texto da mensagem.
- Filtros: número de WhatsApp (empresa ou corretor), responsável, “incluir conversas encerradas”.
- Indicadores por conversa: origem do lead, etapa, não lidas, “⏳ 24h” quando a janela da Meta
  está fechada, e o selo da Zeni quando a IA está conduzindo.

### Janela de chat
- Cabeçalho com nome, etapa do funil e responsável; **Transferir para** outro usuário (gestor).
- **Ligar/desligar a Zeni** na conversa. Responder manualmente **desliga a IA** automaticamente.
- **Qualificar com IA** (entrega a conversa à Zeni) e **Finalizar qualificação e distribuir**
  (gera o dossiê e manda para a roleta na hora).
- **Encerrar / Reabrir** conversa.
- Painel lateral **Ficha do contato** (renda, tempo de carteira, imóvel no nome, valor do
  negócio, data de criação) com link para a ficha completa.
- Bolhas diferenciam cliente, usuário, Zeni e mensagens de sistema; mostram status de envio
  (enviado, entregue, lido, falhou) e marcam os **modelos aprovados da Meta**.

### Composer (campo de mensagem)
- Texto com quebra automática de altura e **picker de emojis**.
- **Respostas rápidas**: digite `/` para buscar mensagens prontas.
- **Anexos**: imagem, PDF e áudio.
- **Gravação de áudio** direto no navegador.
- **Enviar imóvel do catálogo**: monta uma mensagem formatada (título, código, bairro, quartos,
  área, preço e descrição).

### Regra da janela de 24h (API Oficial)
- Na API oficial da Meta, mensagens livres só saem se o cliente escreveu nas últimas 24h.
- Com a janela fechada, o composer é bloqueado e aparece **“Enviar Modelo Aprovado (Meta)”**;
  após o modelo, a janela reabre quando o cliente responder.
- Números via QR Code (Evolution) não têm essa restrição.

### Nova conversa
- Escolha o número remetente (API Oficial ou QR Code), um contato existente ou um número novo.
- Na API Oficial é **obrigatório** iniciar com um modelo aprovado.

### Simulador (modo demonstração)
- **“🧪 Simular um lead chegando pelo WhatsApp”** / **“Simular mensagem do cliente”**: injeta uma
  mensagem recebida que passa pelo **mesmo pipeline do webhook** — cria o lead, aplica o rastreio
  SEO (inclua `[Ref: #SEO-XXXX]` no texto), aciona a Zeni e, no fim, a roleta.

---

## 6. Zeni ✨ — o assistente de IA

A Zeni tem três frentes: **atendimento automático** no WhatsApp, **automações** agendadas e
**copiloto** interno para a equipe. O nome é configurável (ex.: “Clara”).

### 6.1 Atendimento no WhatsApp (qualificação)

Configurado em *Zeni → Automações → Atendimento no WhatsApp → Configurar*. O drawer tem:

**Identidade e estilo**
- Nome do assistente e **padrão de atendimento** (preset): MCMV/Econômico, Médio padrão, Alto
  padrão, Locação, Lançamento, Terreno, Venda e locação, Serviços/SEO Geral ou Do zero. Cada
  preset sugere um roteiro de perguntas.
- Foco (vendas, locação, ambos), **tom** (informal, no meio, formal), **emojis** (nenhum,
  poucos, muitos), **tamanho das mensagens** (curtas uma a uma, médias, longas), cidade de atuação.
- **Mensagem inicial** com variáveis `{{nome_assistente}}`, `{{nome_empresa}}`, `{{nome_cliente}}`, `{{cidade}}`.
- **Instruções extras** (até 500 caracteres) e **objetivo da qualificação**.

**Capacidades de mídia**
- Transcrever áudios do cliente (Whisper).
- Interpretar fotos e documentos (holerite, RG, comprovantes) por visão computacional.
- Recomendar itens do **catálogo de imóveis** quando o cliente pede opções.

**Roteiro de perguntas (até 10)**
- Cada pergunta pode preencher um campo do contato (renda, tipo de trabalho, tempo de carteira,
  entrada, FGTS, imóvel no nome, compra sozinho/acompanhado, bairro, interesse, profissão,
  estado civil, orçamento) ou ficar como texto livre.
- Modo **Se der**: se o cliente pular ou mudar de assunto, segue adiante sem travar.
- Modo **Obrigatória**: insiste educadamente (até 3 tentativas) antes de pular.

**Dúvidas frequentes (FAQ)**
- Pergunta, resposta e palavras-chave; podem ser ligadas/desligadas. Vêm prontas: uso do FGTS,
  documentos necessários, escritura/financiamento e permuta.

**Transbordo para o corretor**
- Transfere na hora se o lead pedir para falar com uma pessoa.
- Transfere após **inatividade** configurável, com o que já foi coletado.
- Mensagem de transferência personalizável.

**Onde o lead entra e para onde vai**
- Funil e etapa de entrada dos novos contatos; etapa pós-qualificação (ou manter a atual).
- **Distribuição**: roleta de corretores (round-robin ponderado), gestor distribui manualmente
  (lead fica sem responsável e o gestor é notificado) ou usuário específico.
- **Avisar o corretor no WhatsApp**: envia o dossiê para o WhatsApp pessoal do corretor sorteado.

**Simulador “Testar conversa”**
- Prévia ao vivo que roda o mesmo motor com a configuração **ainda não salva**, mostra a conversa
  e o relatório que o corretor receberia.

**Como o motor decide**
1. Mídia é convertida em texto (se habilitado).
2. **Modo LLM** (com chave OpenAI/Gemini): o modelo recebe o roteiro e devolve JSON validado com
   respostas, dados extraídos, perguntas respondidas/puladas e se o cliente quer um humano.
3. **Modo regras** (sem chave ou se o LLM falhar): extratores em português entendem “uns 4 mil e
   quinhentos”, “carteira assinada”, “sim, 6 anos”, “com minha esposa”, sim/não etc.; FAQs são
   reconhecidas por palavras-chave.
4. Ao fim do roteiro, pedido de humano ou timeout → **transbordo**.

**Dossiê estruturado de qualificação** (gravado na ficha do contato)
- Dados coletados, origem/página SEO, **faixa do Minha Casa Minha Vida** pela renda
  (Faixa 1 até R$ 2.850 · Faixa 2 até R$ 4.700 · Faixa 3 até R$ 8.600 · Faixa 4 até R$ 12.000 ·
  acima disso SBPE).
- **Poder de compra estimado** (parcela ≤ 30% da renda, 360 meses, ~0,8% a.m. + entrada + FGTS).
- **Temperatura do lead**: pontuação de 0 a 100 → *Quente* (≥ 70), *Morno* (≥ 40) ou *Frio*.
- Com LLM, ganha uma recomendação de próxima ação.

### 6.2 Automações

Página *Zeni → Automações*. Cada automação pode ser ligada/desligada e restrita a um número.
Executadas pelo agendador a cada minuto, sem repetir a mesma ação para o mesmo contato.

| Automação | O que faz | Parâmetro |
| --- | --- | --- |
| **Atendimento no WhatsApp** | Qualificação descrita acima. | Drawer completo |
| **Lembrete de visita** | Lembra o cliente (WhatsApp) e o corretor (notificação) antes da visita. | Horas de antecedência (padrão 24) |
| **Acompanhamento do corretor** | Cobra o corretor quando o lead espera resposta. | Minutos sem resposta (padrão 30) |
| **Pós-visita** | No dia seguinte pergunta ao cliente o que achou do imóvel (nota de 0 a 10). | Horas após a visita |
| **Reengajamento de leads** | Retoma leads parados com uma mensagem leve. | Dias parados (padrão 15) |
| **Datas anuais** | Parabeniza o cliente no aniversário. | — |

Se a janela de 24h da Meta estiver fechada, a mensagem não sai: a Zeni registra a pendência na
timeline do contato e avisa o corretor.

### 6.3 Copiloto (chat interno)

Página `/ia`. Um chat para gestores e corretores perguntarem sobre os dados do CRM, com
histórico de conversas (threads) na lateral.

- **Atalhos prontos**: Relatório dos corretores · Leads sem resposta · Tarefas atrasadas ·
  Visitas da semana · Leads sem responsável · Criar campanha (sugere disparos por etapa).
- Respostas em markdown com tabelas e **botões de ação** (ex.: “Abrir aba A responder”,
  “Campanha: Visita agendada”).
- Sem chave de IA, as perguntas livres são roteadas por palavras-chave para os relatórios
  prontos; com chave, o LLM responde livremente usando os dados reais.
- Respeita o RBAC: o corretor só vê os próprios dados.

### 6.4 Pendências

Página *Zeni → Pendências*: o que precisa de atenção agora, com contagem e link:
conversas sem resposta há mais de 30 min, tarefas atrasadas, leads sem responsável, números de
WhatsApp que requerem atenção e modelos rejeitados pela Meta.

---

## 7. Contatos

Página `/contatos`.

### Lista
- Busca por nome, telefone, e-mail ou `#código`.
- Filtros: etapa, responsável (incluindo “sem responsável”), origem (com atalho “🌐 Google
  Orgânico / SEO”) e etiqueta.
- Colunas: WhatsApp/telefone, funil e etapa, responsável, origem, última interação; atalho para
  abrir a conversa.
- **Exportar CSV** com os filtros aplicados.
- **Ações em massa** (seleção múltipla): mover etapa, atribuir responsável, adicionar etiqueta,
  ligar/desligar qualificação com IA, **criar campanha** com os selecionados e excluir.

### Criar contato
- WhatsApp (obrigatório), nome, e-mail, origem, etapa, responsável, página de conversão e etiquetas.

### Importar (Excel/CSV)
1. Arrastar a planilha (`.csv`, `.xlsx`, `.xls`).
2. **Mapeamento automático** das colunas para os campos do CRM (ajustável; telefone obrigatório).
3. Etapa, responsável, origem e etiquetas padrão; opção de **atualizar contatos existentes**
   com o mesmo telefone. Mostra quantas linhas têm telefone válido.

### Ficha 360º (drawer do contato)
- Cabeçalho com etiquetas, funil/etapa, responsável e **resumo da qualificação da IA**
  (temperatura, faixa de valor) com link para o relatório completo.
- **Dados cadastrais**: PF/PJ, CPF/CNPJ, endereço, cidade/UF, profissão, estado civil, data de
  nascimento, renda familiar, entrada, FGTS, valor do negócio.
- **Origem & SEO**: página de conversão, palavra-chave/UTM, código de rastreio.
- Abas:
  - **Timeline** — todo o histórico; **Registrar interação** (ligação, visita presencial, e-mail,
    WhatsApp pessoal…).
  - **Conversas** — conversas do contato com atalho para o Atendimento.
  - **Anotações** — notas internas.
  - **Tarefas** — tarefas do contato e “Nova tarefa”.
  - **Imóveis** — itens do catálogo recomendados pela Zeni ou vinculados.
- **Marcar ganho / Marcar perdido**, campanhas recebidas e exclusão do contato com histórico.

---

## 8. Funis (Análise e Kanban)

Página `/funis`.

- Vários funis por workspace (ex.: *Funil de vendas* e *Funil de aluguel*); criar, editar
  (nome, etapas, cores, **etapa de ganho**) e **tornar padrão**. Leads de etapas removidas vão para
  a primeira etapa.
- Etapas padrão: Lead → Qualificação → Visita agendada → Proposta → Negociação → Documentação → Fechado.
- Filtros: período (7/30/90 dias ou tudo), status (aberto/ganho/perdido), usuário, origem e
  busca. Filtrar por **Google Orgânico** mostra o ROI do SEO.

**Visão Análise**
- Distribuição atual por etapa (quantidade, % e valor) com botão para **criar campanha para a etapa**.
- Matriz **usuário × etapa** — onde está a carteira de cada corretor.
- **Ranking de corretores**: leads recebidos, valor gerado e conversão.

**Visão Kanban**
- Arrastar e soltar entre etapas (soltar na etapa de ganho comemora 🎉).
- Cards com origem, selo “Qualificado pela IA”, responsável, **tempo parado na etapa** e atalho
  “Abrir WhatsApp”.

---

## 9. Campanhas, Modelos e Formulários

### 9.1 Campanhas (`/campanhas`)
- Totais: mensagens enviadas, taxa de resposta e **investimento estimado na Meta**.
- Cada campanha mostra progresso, falhas, custo, agendamento, limite de horário, selos “IA” e
  “A/B”, e permite **Enviar agora** ou excluir.

**Criar campanha**
- Nome e **número remetente** (empresa ou corretor).
- **Modelo A** e, opcionalmente, **Teste A/B** com modelo B (metade recebe cada um).
- **Destinatários**: contatos selecionados manualmente ou filtros por funil/etapas, corretor
  responsável, origem e etiqueta, com amostra ao vivo.
- **Enviar agora** ou **agendar** data/hora; **limite de horário** de envio (o que sobrar continua
  no dia seguinte).
- **Entregar respostas à Zeni**: quando o cliente responder (“Eu quero!”), a IA assume e
  continua a qualificação.
- **Custo estimado** pela tarifa da Meta (Marketing R$ 0,3217 · Utilidade R$ 0,035 ·
  Autenticação R$ 0,035). Em número QR: sem custo Meta, com alerta de risco de bloqueio.
- Prévia da mensagem com os dados de um contato real; salvar rascunho.
- Envio em **lotes**, com acompanhamento de status por destinatário.

### 9.2 Modelos de mensagem (`/campanhas/modelos`)
- Editor de templates da Meta: número, nome (`minusculas_e_underscore`), idioma (pt-BR / en-US),
  **categoria** (com o preço exibido), cabeçalho (texto, imagem, vídeo ou documento), corpo com
  variáveis `{{1}}`, `{{2}}`…, rodapé e botões (resposta rápida, URL, telefone).
- **Injetor de variáveis**: cada `{{n}}` é mapeado para um dado (nome, telefone, e-mail, CPF,
  cidade, bairro, profissão, renda, nome do corretor, nome da empresa).
- **Fallback inteligente**: se o contato não tiver nome, a variável e a pontuação sobrando somem.
- **Preview ao vivo** em balão do WhatsApp, com e sem nome.
- Status: Rascunho → Em análise → Aprovado / Rejeitado (com motivo). **Enviar para aprovação**.

### 9.3 Formulários (`/campanhas/formularios`)
- Monta formulários para o site (campos, obrigatoriedade, texto do botão, etapa de entrada).
- **Copiar código** de incorporação: o envio cria o lead com a origem SEO completa.

---

## 10. Imóveis (catálogo)

Página `/imoveis`.
- Cadastro de imóveis/serviços: título, código, categoria, preço, bairro, cidade, quartos,
  área (m²), descrição, fotos (URLs) e status (Disponível, Reservado, Vendido, Alugado, Inativo).
- Busca por título, código ou bairro; filtros por categoria e status.
- Mostra os **leads interessados** em cada item.
- Usado pela Zeni para recomendar opções e pelo composer para enviar o imóvel no chat.

---

## 11. Agenda (tarefas)

Página `/agenda`.
- Tipos: **Visita**, **Ligação**, **Follow-up** e **Documentação** (cores próprias).
- Visão semanal e lista; seção de **atrasadas**; filtros por usuário e tipo.
- Nova tarefa: título, tipo, data/hora, contato, responsável e observações.
- **Agendar uma visita move o lead para “Visita agendada”** e dispara o lembrete da Zeni (se a
  automação estiver ligada).
- O corretor vê só a própria agenda.

---

## 12. Relatórios

Página `/relatorios` (período de 7/30/90 dias):
- KPIs: novos leads, vendas fechadas, **qualificados pela IA** (% dos novos), **tempo médio da
  1ª resposta**, conversas iniciadas, conversão (ganhos/novos) e ticket médio.
- Gráfico de **leads por dia** (total × Google Orgânico).
- **Leads por origem**, **mensagens por remetente** (cliente, equipe, Zeni, sistema) e campanhas
  do período.

---

## 13. Site & SEO (rastreamento e white-label)

Página `/site-seo`.

### Painel de ROI do SEO (30/90/180 dias)
- Leads via SEO orgânico (e % do total), visitas rastreadas, taxa de qualificação da IA nos
  leads SEO e **negócios fechados vindos do SEO** (valor e quantidade).
- **Páginas que mais geraram conversas** no WhatsApp.
- Leads SEO por semana e últimas sessões rastreadas (origem, página de entrada, se virou lead).

### Script de rastreio `tracker.js` (plug & play)
- Colado antes do `</body>` do site do cliente (ou via Google Tag Manager).
- Detecta a origem: Google/Bing orgânico, Google Ads, Facebook/Instagram, OLX e portais.
- Guarda a **página exata de entrada** (first-touch, 30 dias).
- Intercepta cliques em links de WhatsApp e **injeta o protocolo `[Ref: #SEO-XXXX]`** na mensagem;
  o webhook usa esse código para vincular a conversa à página do Google.
- Intercepta formulários e cria o lead com a origem completa.
- Opção de **botão flutuante de WhatsApp**.
- **“Testar em um site de exemplo”** abre `/demo-site`, um blog fictício que roda o script.

### Configuração White-Label
- Nome da marca, nome padrão do assistente, URL do logo, cores primária e secundária (com paletas
  sugeridas e prévia) e **domínio personalizado** (CNAME). Aplica-se ao topo, ao login e ao
  atendimento de todos os clientes da agência.

---

## 14. Integrações

Página `/integracoes`, em abas:

**WhatsApp Oficial (Cloud API)**
- Conectar o número com WABA ID, Phone Number ID e token permanente. Exibe as instruções do
  webhook da Meta. Templates aprovados, janela de 24h e disparos sem risco de bloqueio.

**WhatsApp App (QR Code — Evolution API)**
- Conectar o WhatsApp de cada corretor por QR Code (URL/chave/instância opcionais). O gestor
  audita todas as conversas.

Para os dois: números da empresa × dos corretores, status (Conectado, Requer atenção,
Desconectado), última atividade, gerar QR, reconectar e remover.

**Facebook Lead Ads** — formulários instantâneos viram contatos na hora, com **mapeamento de campos**
(campo do Facebook → campo do CRM), etapa de entrada e roleta.

**Google Ads** — leads dos formulários de lead (webhook de extensão de formulário).

**Portais / Webhooks** — Grupo OLX (ZAP + Viva Real), Chaves na Mão, Imovelweb ou qualquer
sistema que envie JSON (`name`, `phone`, `email`, `message`, `listing_id`).

Cada integração tem URL própria de webhook (com token), contador de leads recebidos e data do
último evento.

---

## 15. Equipe e roleta de distribuição

Página `/equipe`.
- Lista de membros com perfil, telefone e status; **convidar membro** (gera senha provisória
  mostrada uma única vez); **desativar** (os leads da pessoa ficam sem responsável).
- **Permissões por módulo** do Assistente, incluindo “ver leads de toda a equipe”.
- **Roleta de distribuição**: quem está no plantão, **peso** de cada corretor, **próximo da fila** e
  últimos leads distribuídos.
- Regra da roleta: escolhe quem tem a menor relação *(leads recebidos nos últimos 7 dias ÷ peso)*;
  empate vai para quem recebeu há mais tempo. O corretor sorteado é avisado no WhatsApp pessoal.

---

## 16. Notificações

Geradas automaticamente, por exemplo: lead novo atribuído, lead esperando resposta além do
tempo, lembrete de visita, lead aguardando distribuição. Aparecem no sino com link direto
para a conversa, contato ou agenda.

---

## 17. Fluxos de ponta a ponta

### A) Lead do Google até a venda
1. Visitante chega ao blog pelo Google → `tracker.js` registra a sessão e a página.
2. Clica em “Falar no WhatsApp” → a mensagem sai com `[Ref: #SEO-5017]`.
3. Webhook recebe → cria o contato com origem **SEO Orgânico**, página e palavra-chave.
4. A Zeni responde, faz as perguntas e monta o dossiê (faixa MCMV, poder de compra, temperatura).
5. Transbordo → etapa pós-qualificação → roleta escolhe o corretor → aviso no WhatsApp dele.
6. Corretor agenda a visita → lead vai para “Visita agendada” → lembrete automático.
7. Fechamento no Kanban → a venda aparece no **ROI do SEO** ligada à página de origem.

### B) Lead de anúncio (Facebook / Google Ads / portal)
Formulário → webhook `/api/webhooks/leads/:token` → mapeamento de campos → contato no funil →
roleta → corretor notificado.

### C) Campanha de reengajamento
Filtrar contatos (ex.: etapa “Proposta”) → modelo aprovado → custo estimado → disparo em lotes
dentro do horário → quem responde volta para a Zeni, que continua a qualificação.

### D) Gestão diária
Gestor abre *Zeni → Pendências* ou pergunta ao copiloto “quais corretores estão com mais leads sem
resposta?” → clica na ação sugerida → resolve no Atendimento ou na Agenda.

---

## 18. Endpoints públicos e API

| Rota | Função |
| --- | --- |
| `GET/POST /api/webhooks/meta` | Verificação e eventos da WhatsApp Cloud API (mensagens e status de entrega/leitura), com checagem de `X-Hub-Signature-256`. |
| `POST /api/webhooks/evolution` | Mensagens, conexão e QR Code da Evolution API. |
| `POST /api/webhooks/leads/:token` | Facebook Lead Ads, Google Ads, portais e JSON genérico. |
| `GET /api/tracker.js?k=` | Script de rastreio do site. |
| `POST /api/track/session · /event · /form` | Coleta do tracker (CORS aberto). |
| `POST /api/cron/tick` | Agendador para ambientes serverless (Bearer `CRON_SECRET`). |

A API autenticada (REST, em `src/app/api/`) cobre: autenticação e troca de perfil/workspace,
conversas e mensagens, contatos (CRUD, importação, ações em massa, atividades), funis (quadro e
análise), tarefas, catálogo, modelos e campanhas (prévia, envio), formulários, integrações,
canais (conectar, simular), usuários, roleta, respostas rápidas, notificações, busca global,
relatórios, SEO, agência (white-label) e Zeni (configuração, simulador, copiloto, automações,
pendências).

---

## 19. O que é simulado × o que fica real com credenciais

| Recurso | Na demonstração | Com credenciais reais |
| --- | --- | --- |
| Envio/recebimento WhatsApp (Meta) | Canais com token iniciado por `demo` só **registram** as mensagens. | Envia pela Graph API e recebe pelo webhook. |
| WhatsApp por QR (Evolution) | Sem URL/chave, o “Gerar QR Code” **conecta direto**. | QR real, conexão e mensagens pela Evolution API. |
| Aprovação de modelos | Canal demo **simula a aprovação**. | Envio real à WABA; status e motivo de rejeição da Meta. |
| Disparo de campanhas | Status por destinatário gravado, sem envio real. | Disparo real cobrado pela Meta. |
| Zeni (qualificação) | **Motor de regras em português** (funciona de verdade, sem custo). | Modo LLM (OpenAI ou Gemini) com saídas estruturadas. |
| Áudio e imagem | Ignorados / tratados como texto. | Transcrição (Whisper) e análise por visão. |
| Copiloto | Relatórios prontos por palavra-chave. | Perguntas livres respondidas pelo LLM. |
| Lead chegando | Botão **“Simular mensagem do cliente”** e `/demo-site`. | Webhooks reais e `tracker.js` no site do cliente. |
| Lead Ads / Google Ads / portais | Integrações e contadores do seed. | Webhook com token recebe leads de verdade. |
| Troca de perfil sem senha | Ligado com `DEMO_MODE=true`. | Desligar em produção. |

O que **já funciona de verdade** mesmo na demo (é lógica interna, não depende de terceiros):
RBAC, funis e Kanban, contatos/importação/exportação, ficha 360º, agenda, roleta, dossiê e
pontuação do lead, motor de regras da Zeni, automações agendadas, cálculo de custo, segmentação de
campanhas, análises, relatórios, tracker e vínculo do protocolo SEO, white-label e tempo real.

---

## 20. Dados e contas de demonstração

Senha de todas as contas: **`teo123456`**.

| Perfil | E-mail | Quem é |
| --- | --- | --- |
| Gestor | `gestor@horizonte.com.br` | Patrícia Andrade — vê tudo |
| Assistente | `assistente@horizonte.com.br` | Juliana Reis — módulos liberados em Equipe |
| Corretor | `marcio@horizonte.com.br` | Márcio Lima — na roleta, peso 2 |
| Corretor | `corretor@horizonte.com.br` | Beatriz Nunes — fora do plantão |
| Agência SEO | `agencia@rankalto.com.br` | Lucas Rank — alterna entre clientes |
| Super Admin | `admin@teocrm.com.br` | Acesso à plataforma |

O seed cria:
- **Agência** *CRAP Digital* com dois clientes: *Horizonte Imóveis* (Feira de Santana/BA) e
  *Clínica Sorriso Feira*.
- Corretores Márcio, Camila, Rafael (na roleta) e Beatriz.
- Números: *Horizonte • Comercial* (API Oficial) e os WhatsApps dos corretores via QR, em estados
  diferentes (conectado, requer atenção, desconectado) para mostrar os alertas.
- *Funil de vendas* (padrão) e *Funil de aluguel*; contatos de várias origens; conversas em todos
  os status (com a Zeni, a responder, não lidas…); tarefas; imóveis.
- Modelos (`boas_vindas_lead`, `feirao_mcmv_novembro`, `lembrete_visita`, `pedido_indicacao`,
  `reengajamento_leads` em análise) e campanhas (enviada, agendada e rascunho).
- Integrações de Facebook Lead Ads, Google Ads e Grupo OLX com leads recebidos.

Para rodar localmente ou fazer o deploy gratuito no Render, veja o [README](../README.md).
