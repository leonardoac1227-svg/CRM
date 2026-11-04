# Colocar o Ápice no ar — passo a passo

Este guia leva o Ápice do código até um sistema funcionando na internet, com banco de dados no
**Supabase** e o servidor no **Render**. Não é preciso saber programar: são cadastros e
copiar/colar. Reserve uns **40 minutos** na primeira vez.

> **O que você vai ter no final:** um endereço como `https://apice-xxxx.onrender.com` com a sua
> conta de administrador, pronto para cadastrar clientes, conectar o WhatsApp e instalar o
> rastreio no site.

---

## Visão geral

| Peça | Para que serve | Custo |
| --- | --- | --- |
| **Supabase** | Guarda todos os dados (contatos, conversas…) e os arquivos enviados no chat | Grátis até 500 MB de banco e 1 GB de arquivos |
| **Render** | Roda o Ápice 24 horas | Grátis com limitações (veja o fim do guia) ou US$ 7/mês |
| **Meta (WhatsApp oficial)** | Envia e recebe as mensagens do número da empresa | Responder clientes é grátis; mensagens iniciadas pela empresa são cobradas pela Meta |
| **Evolution API** *(opcional)* | WhatsApp dos corretores pelo QR Code | Roda no Render (veja o passo 5) |

Guarde todas as senhas e códigos que aparecerem num lugar seguro (um gerenciador de senhas ou
um documento só seu). **Nunca envie a senha do banco nem a chave `service_role` para ninguém.**

---

## Passo 1 — Criar o banco no Supabase

1. Acesse **[supabase.com](https://supabase.com)** e clique em **Start your project**. Entre com o
   GitHub ou com e-mail.
2. Clique em **New project**.
   - **Name:** `apice`
   - **Database Password:** clique em **Generate a password** e **copie e guarde** essa senha.
   - **Region:** `South America (São Paulo)`
   - Clique em **Create new project** e espere uns 2 minutos até o painel ficar verde.
3. Pegue os endereços de conexão:
   - No topo do projeto, clique em **Connect** (ou vá em **Project Settings › Database ›
     Connection string**).
   - Na aba **Transaction pooler**, copie o endereço. Ele termina em `:6543/postgres`.
     Troque `[YOUR-PASSWORD]` pela senha do item 2 e **acrescente no final**
     `?pgbouncer=true&connection_limit=1`. Esse é o seu **`DATABASE_URL`**.
   - Na aba **Session pooler**, copie o endereço (termina em `:5432/postgres`) e troque
     `[YOUR-PASSWORD]` pela senha. Esse é o seu **`DIRECT_URL`**.

   Exemplo de como ficam:

   ```
   DATABASE_URL = postgresql://postgres.abcd1234:MinhaSenha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   DIRECT_URL   = postgresql://postgres.abcd1234:MinhaSenha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

   > Se a sua senha tiver caracteres como `@`, `#` ou `/`, gere outra só com letras e números —
   > esses símbolos quebram o endereço.

4. Pegue as chaves de arquivos: vá em **Project Settings › API** (ou **API Keys**).
   - **Project URL** (ex.: `https://abcd1234.supabase.co`) → é o **`SUPABASE_URL`**.
   - Chave **`service_role`** (se houver a aba **Legacy API keys**, use a de lá) → clique em
     **Reveal**, copie → é o **`SUPABASE_SERVICE_ROLE_KEY`**. Essa chave dá acesso total: não
     compartilhe.

Você não precisa criar tabelas nem pastas: o Ápice cria tudo sozinho no primeiro start.

---

## Passo 2 — (Opcional) Chave gratuita da IA

A Zeni funciona sem chave, com um motor de regras próprio. Com uma chave gratuita do Google ela
fica mais esperta, entende áudios e responde perguntas livres no copiloto.

1. Acesse **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** e entre com uma
   conta Google.
2. Clique em **Create API key** e copie → é o **`GEMINI_API_KEY`**.

---

## Passo 3 — Publicar no Render

1. Acesse **[render.com](https://render.com)** e crie a conta **entrando com o GitHub** (a mesma
   conta onde está o repositório `CRM`).
2. No painel, clique em **New › Blueprint**.
3. Escolha o repositório **CRM**. O Render lê o arquivo `render.yaml` e mostra dois serviços:
   `apice` (o sistema) e `apice-whatsapp-qr` (o servidor do QR Code).
4. Preencha os campos que ele pedir:

   | Campo | O que colar |
   | --- | --- |
   | `DATABASE_URL` | O endereço *Transaction pooler* do passo 1 |
   | `DIRECT_URL` | O endereço *Session pooler* do passo 1 |
   | `SUPABASE_URL` | O *Project URL* do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | A chave *service_role* do passo 1 |
   | `ADMIN_NAME` | Seu nome |
   | `ADMIN_EMAIL` | O e-mail que você vai usar para entrar |
   | `ADMIN_PASSWORD` | Uma senha forte (ou deixe em branco para gerar uma provisória) |
   | `GEMINI_API_KEY` | A chave do passo 2 (ou deixe em branco) |
   | `DATABASE_CONNECTION_URI` | O mesmo *Session pooler* do passo 1 **com `?schema=evolution` no final** |
   | `EVOLUTION_API_URL`, `SERVER_URL`, `KEEPALIVE_URL` | Deixe em branco por enquanto (passo 5) |

5. Clique em **Apply**. O primeiro deploy leva uns 5 minutos. Acompanhe em
   **apice › Logs** — quando aparecer `▲ Ápice pronto`, está no ar.
6. O endereço do sistema aparece no topo da página do serviço `apice`
   (ex.: `https://apice-xxxx.onrender.com`).

> **Senha provisória:** se você deixou `ADMIN_PASSWORD` em branco, a senha aparece nos **Logs**
> do primeiro start, na linha `Senha provisória: ...`.

---

## Passo 4 — Primeiro acesso

1. Abra o endereço do sistema e entre com o `ADMIN_EMAIL` e a senha.
2. Se entrou com senha provisória, o Ápice pede para você criar a sua.
3. Pronto! Agora, dentro do sistema:
   - **Configurar › Clientes › Novo cliente**: cadastre cada empresa atendida e o gestor dela.
     O Ápice gera uma senha provisória e um convite pronto para mandar no WhatsApp.
   - **Configurar › Integrações › WhatsApp**: conecte o número oficial (assistente de 7 passos)
     ou os celulares pelo QR Code.
   - **Crescer › Site & SEO › Começar instalação**: instale o rastreio no site, com verificação
     automática.
   - **Integrações › Facebook / Google Ads / Portais**: receba os leads dos anúncios.

Cada um desses lugares tem o passo a passo na própria tela, escrito para quem nunca fez isso.

---

## Passo 5 — WhatsApp pelo QR Code (opcional)

Só é necessário para conectar o celular dos corretores. O número oficial da empresa (API da
Meta) não depende disto.

1. No Render, abra o serviço **apice-whatsapp-qr** e copie o endereço dele no topo
   (ex.: `https://apice-whatsapp-qr.onrender.com`).
2. Ainda nele, vá em **Environment**, preencha **`SERVER_URL`** com esse endereço e salve.
3. Abra o serviço **apice › Environment** e preencha com o mesmo endereço:
   - **`EVOLUTION_API_URL`**
   - **`KEEPALIVE_URL`** (mantém o servidor do QR Code acordado)
4. Salve: o Render reinicia o Ápice sozinho. A chave entre os dois serviços
   (`EVOLUTION_API_KEY`) já foi ligada automaticamente.
5. No Ápice, **Integrações › WhatsApp › Conectar um celular** já deve funcionar.

---

## Sobre o plano gratuito do Render (leia antes de usar com clientes)

- **O serviço “dorme” depois de 15 minutos sem acessos.** A primeira mensagem ou acesso depois
  disso acorda o sistema, o que leva uns 50 segundos. A Meta reenvia as mensagens que não foram
  entregues, então elas não se perdem — mas a resposta da Zeni atrasa e as automações (lembretes,
  cobranças) só rodam com o sistema acordado.
- **Para manter acordado de graça:** crie uma conta grátis no
  **[UptimeRobot](https://uptimerobot.com)**, clique em **Add New Monitor**, tipo **HTTP(s)**,
  cole `https://SEU-ENDERECO.onrender.com/api/health` e escolha intervalo de **5 minutos**.
- **Limite de 750 horas por mês somando os serviços gratuitos.** Isso dá para **um** serviço
  ligado o mês inteiro. Com o Ápice e o servidor de QR Code os dois sempre acordados, a conta
  passa do limite. Na prática:
  - **Só API oficial:** plano gratuito + UptimeRobot no Ápice funciona bem.
  - **Com QR Code:** coloque um dos dois serviços no plano **Starter (US$ 7/mês)** — de
    preferência o `apice-whatsapp-qr`, que precisa ficar ligado para o celular não desconectar.
- **Projetos gratuitos do Supabase são pausados após 7 dias sem uso.** Com o sistema em uso
  diário isso não acontece; se acontecer, é só entrar no painel do Supabase e clicar em
  **Restore**.

Quando os clientes estiverem usando de verdade, o recomendado é o plano **Starter** no Render
para o `apice` (sempre acordado, sem atrasos).

---

## Domínio próprio (opcional)

1. No Render, abra **apice › Settings › Custom Domains › Add Custom Domain** e digite, por
   exemplo, `crm.crapdigital.com.br`.
2. No painel onde você comprou o domínio (Registro.br, Hostinger, GoDaddy…), crie o registro
   **CNAME** que o Render mostrar.
3. Em **apice › Environment**, defina **`APP_URL`** = `https://crm.crapdigital.com.br`.
4. Se já tinha conectado o WhatsApp oficial, atualize a URL do webhook na Meta (o assistente em
   **Integrações › WhatsApp › Webhook** mostra a nova URL).

---

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| Deploy falha com erro de banco (`P1001`, `Can't reach database`) | Confira `DATABASE_URL` e `DIRECT_URL`: senha certa, sem `[YOUR-PASSWORD]`, e `?pgbouncer=true&connection_limit=1` só no `DATABASE_URL`. |
| `Defina ADMIN_EMAIL` nos logs | Preencha `ADMIN_EMAIL` em **apice › Environment** e salve. |
| Não lembro a senha do administrador | Outro gestor pode gerar uma nova em **Equipe** (ícone de chave). Se for o único acesso, apague a linha do usuário no Supabase (**Table Editor › User**) e deixe o banco sem agência para o Ápice recriar — ou peça ajuda ao desenvolvedor. |
| A Meta diz que não validou a URL do webhook | O sistema estava dormindo: abra o endereço do Ápice numa aba, espere carregar e clique em **Verificar e salvar** de novo. |
| Arquivos do chat somem depois de um deploy | Faltam `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. |
| QR Code não aparece | Confira o passo 5 e veja os logs do `apice-whatsapp-qr`. |

---

## Rodar no seu computador (para desenvolvedores)

```bash
cp .env.example .env     # preencha DATABASE_URL, DIRECT_URL, JWT_SECRET e ADMIN_EMAIL
npm install
npm run db:push          # cria as tabelas
npm run db:seed          # cria a agência, a primeira empresa e o administrador
npm run dev              # http://localhost:3000
```

Sem um endereço público, o WhatsApp não consegue entregar mensagens no seu computador. Para
testar a integração localmente, use um túnel como `cloudflared tunnel --url http://localhost:3000`
e defina `APP_URL` com o endereço gerado.
