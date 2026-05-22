# Auditoria Técnica — EventosOmega

**Data:** 22/05/2026  
**Versão analisada:** commit `60ec12b` (main)  
**Ambiente de produção:** https://eventos-omega-six.vercel.app  
**Repositório:** https://github.com/caiomktdev/eventos-omega  
**Escopo:** Varredura completa do repositório — código, rotas, pagamentos, lacunas para produção 100%

> **Substitui** a auditoria de 20/05/2026 e o documento `EventosOmega-Contexto-Tecnico.doc`.

---

## Sumário executivo

| Área | Status | Prontidão |
|------|--------|-----------|
| Vitrine pública + inscrição | ✅ Funcional | 95% |
| Painel organizador + admin | ✅ Funcional | 90% |
| Mercado Pago marketplace (OAuth split) | ⚠️ Parcial | 75% |
| Checkout embarcado (cartão/PIX/boleto) | ⚠️ Parcial | 80% |
| PIX com QR Code + copia e cola | ✅ Implementado | 85% |
| Webhook + confirmação de pagamento | ✅ Implementado | 90% |
| **Envio de ingresso por e-mail** | ❌ **Não existe** | **0%** |
| Ingresso digital (PDF/QR check-in) | ❌ Não existe | 0% |
| Testes automatizados | ⚠️ Mínimo | 25% |
| Observabilidade / e-mail / storage | ❌ Ausente | 10% |

**Prontidão geral estimada para produção 100%: ~72%**

O sistema **já vende ingressos e processa pagamentos**, mas **não está 100% pronto** até implementar e-mail transacional pós-pagamento, regularizar contas MP dos organizadores e fechar lacunas de operação/testes.

---

## 1. Inventário do repositório

### 1.1 Métricas

| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript/TSX (`src/`, `prisma/`, `scripts/`) | 122 |
| Linhas de código (aprox.) | **17.213** |
| Rotas de API (`route.ts`) | **25** |
| Páginas App Router | **19** |
| Componentes React | ~55 |
| Módulos `lib/` | 15 |
| Migrations Prisma | 5 |
| Testes unitários | 2 arquivos |
| CI GitHub Actions | ✅ lint + test + build |

### 1.2 Stack

- **Next.js** 16.2.6 (App Router, Turbopack)
- **React** 19, **TypeScript** 5
- **Prisma** 5.22 + **PostgreSQL**
- **Auth.js** v5 (Credentials, JWT)
- **Mercado Pago** SDK 2.0.15 + `@mercadopago/sdk-react` 1.0.7
- **Tailwind** 3.4 + Shadcn/ui + Lucide
- **Deploy:** Vercel (região `gru1`)

### 1.3 Estrutura de diretórios

```
eventos-omega/
├── .github/workflows/ci.yml
├── docs/
│   └── AUDITORIA-TECNICA.md          ← este documento
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/                   (5 migrations)
├── public/brand/                     (logo, favicon)
├── scripts/smoke-home.ts
├── src/
│   ├── app/
│   │   ├── admin/(panel)/            (login, dashboard, eventos, sponsors)
│   │   ├── api/                      (25 handlers — ver §2)
│   │   ├── checkout/[id]/          (checkout embarcado)
│   │   ├── dashboard/              (organizador)
│   │   ├── event/[slug]/           (página pública + inscrição)
│   │   ├── events/[id]/            (redirect legado)
│   │   ├── meus-ingressos/         (consulta por e-mail)
│   │   ├── payment/{success,failure}/
│   │   └── page.tsx                  (home)
│   ├── auth.config.ts, auth.ts, middleware.ts
│   ├── components/                 (admin, auth, checkout, dashboard, events, home, tickets, ui)
│   ├── hooks/                        (use-toast, use-transaction)
│   ├── lib/                          (fee, mercadopago, oauth, validations, etc.)
│   └── types/
├── .env.example
├── next.config.ts
├── vercel.json
└── package.json
```

---

## 2. Mapeamento de rotas e APIs

### 2.1 Páginas públicas

| Rota | Função | Status |
|------|--------|--------|
| `/` | Home: carrossel, categorias, grid de eventos, patrocinadores, FAQ | ✅ |
| `/event/[slug]` | Detalhe do evento + formulário de inscrição dinâmico | ✅ |
| `/events/[id]` | Redirect 308 → `/event/[slug]` | ✅ |
| `/meus-ingressos` | Busca ingressos por e-mail (sem login) | ✅ |
| `/checkout/[id]` | Checkout embarcado / retentativa de pagamento | ✅ |
| `/payment/success` | Landing pós-pagamento MP | ⚠️ Genérica |
| `/payment/failure` | Landing de falha MP | ✅ |

### 2.2 Painéis autenticados

| Rota | Papel | Função | Status |
|------|-------|--------|--------|
| `/admin/login` | Público | Login unificado | ✅ |
| `/admin` | ADMIN | Lista de eventos + KPIs | ✅ |
| `/admin/dashboard` | ADMIN | Dashboard financeiro plataforma | ✅ |
| `/admin/sponsors` | ADMIN | Patrocinadores/banners globais | ✅ |
| `/admin/events/*` | ADMIN | CRUD eventos + participantes + export CSV | ✅ |
| `/dashboard` | ORGANIZER/ADMIN | Painel organizador + conectar MP | ✅ |
| `/dashboard/events/*` | ORGANIZER/ADMIN | CRUD eventos próprios | ✅ |
| `/dashboard/sponsors` | ADMIN | Mídias de patrocinadores por evento | ✅ |

**Middleware:** `/admin/*` → ADMIN; `/dashboard/*` → ADMIN ou ORGANIZER.

### 2.3 APIs (25 arquivos)

#### Pagamentos e inscrição

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/enroll` | POST | Inscrição pública, estoque, fees no servidor, redirect checkout |
| `/api/checkout` | POST | Cria MP Preference (marketplace_fee, OAuth organizador) |
| `/api/payments/process` | POST | Payment Brick → MP Payment (application_fee) |
| `/api/webhooks/mercadopago` | GET/POST | IPN HMAC, reconciliação, idempotência, libera estoque |
| `/api/participants/[id]/transaction` | GET | Polling de status (e-mail ou manager) |
| `/api/my-tickets` | GET | Lista inscrições por e-mail |

#### Mercado Pago OAuth

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/mercadopago/connect` | GET | Inicia OAuth organizador |
| `/api/mercadopago/callback` | GET | Callback OAuth, persiste tokens |
| `/api/mercadopago/disconnect` | POST | Desconecta conta MP |

#### Eventos e admin

| Endpoint | Métodos | Função |
|----------|---------|--------|
| `/api/events` | GET, POST | Lista publicados / cria (auth) |
| `/api/events/featured` | GET | Eventos em destaque (home) |
| `/api/events/cities` | GET | Filtro por cidade |
| `/api/admin/events` | GET, POST | Admin: eventos + métricas |
| `/api/admin/events/[id]` | GET, PATCH | Detalhe + update |
| `/api/admin/events/[id]/export` | GET | Export CSV participantes |
| `/api/admin/events/[id]/sponsors` | GET, POST | Patrocinadores do evento |
| `/api/admin/events/[id]/sponsors/[sponsorId]` | PATCH, DELETE | CRUD sponsor |
| `/api/admin/participants/[id]` | PATCH | Editar formData participante |
| `/api/admin/platform-banners` | GET, POST | Banners home |
| `/api/admin/platform-banners/[id]` | PATCH, DELETE | CRUD banner |
| `/api/admin/platform-sponsors` | GET, POST | Logos patrocinadores |
| `/api/admin/platform-sponsors/[id]` | PATCH, DELETE | CRUD logo |
| `/api/promo/sponsors` | GET | Banners ativos (público) |
| `/api/promo/platform-sponsors` | GET | Logos ativos (público) |
| `/api/auth/[...nextauth]` | GET, POST | Auth.js handlers |

---

## 3. Modelo de dados (Prisma)

| Modelo | Papel |
|--------|-------|
| `User` | ADMIN / ORGANIZER / BUYER + tokens OAuth MP |
| `Event` | Evento + `formStructure` JSON dinâmico |
| `TicketType` | Tipos de ingresso + controle de estoque |
| `Participant` | Inscrição + `ordemCompra` sequencial + `formData` |
| `Transaction` | grossValue, mooveFee, organizerNetValue, status MP |
| `EventSponsorMedia` | Patrocinadores por evento |
| `PlatformSponsor` | Logos globais home |
| `PlatformBannerMedia` | Banners promocionais home |

**Observação:** Comentários no schema ainda citam taxa de **2%** — código real usa **5,5%** (`src/lib/fee.ts`).

---

## 4. Regra financeira (Moove)

| Item | Valor atual |
|------|-------------|
| Taxa Moove | **5,5%** sobre valor bruto (`MOOVE_FEE_RATE = 0.055`) |
| Cálculo | Servidor only — `calculateMooveFee()` em centavos |
| Split MP | `marketplace_fee` (Preference) + `application_fee` (Payment) |
| Token pagamento | OAuth do **organizador** |
| Token webhook | Access token da **plataforma Moove** |

**Inconsistência documental:** comentários em `enroll/route.ts`, `checkout/route.ts`, `schema.prisma` e UI antiga ainda mencionam 2%. Corrigir comentários para evitar confusão operacional.

---

## 5. Fluxo de pagamentos (análise detalhada)

### 5.1 Fluxo completo

```
1. Comprador preenche formulário em /event/[slug]
2. POST /api/enroll
   → Participant (REGISTERED) + Transaction (PENDING)
   → soldQuantity++
   → redirectTo: /checkout/{participantId}

3. /checkout/[id]
   → EmbeddedPaymentCheckout (Payment Brick MP)
   → POST /api/checkout (se necessário) → Preference MP

4. Comprador clica Pagar
   → POST /api/payments/process
   → MP Payment com application_fee (split)

5. PIX pendente:
   → Resposta API com qr_code + qr_code_base64
   → PixPaymentDisplay (QR + botão copiar)
   → Fallback: StatusScreen Brick

6. Cartão aprovado:
   → redirect /payment/success

7. MP envia webhook POST /api/webhooks/mercadopago
   → HMAC-SHA256 validado
   → Busca payment na API MP
   → Reconcilia valor (anti-fraude)
   → APPROVED → Participant CONFIRMED
   → REJECTED/CANCELLED → libera estoque
```

### 5.2 PIX — status atual

| Requisito | Status | Arquivo |
|-----------|--------|---------|
| Seleção PIX no Payment Brick | ✅ | `embedded-payment-checkout.tsx` |
| Criação pagamento PIX no backend | ✅ | `api/payments/process/route.ts` |
| QR Code na tela | ✅ | `pix-payment-display.tsx` |
| Código copia e cola + botão copiar | ✅ | `pix-payment-display.tsx` |
| Reabrir QR de PIX pendente | ⚠️ Parcial | StatusScreen (sem fetch PIX ao reabrir) |
| Mensagem de erro visível se falhar | ✅ | Alerta vermelho no checkout |
| Link ticket_url MP | ✅ | Link "Abrir pagamento no Mercado Pago" |

### 5.3 Bloqueadores conhecidos de pagamento

1. **Organizador sem conta MP conectada** → checkout retorna 422 `ORGANIZER_MP_NOT_CONNECTED`
2. **Conta MP do organizador não habilitada para receber** → erro MP (ex.: "COLEGIO OMEGA não pode receber pagamentos") — **configuração no painel MP**, não código
3. **Organizador precisa completar cadastro vendedor** no Mercado Pago (KYC, dados bancários)
4. **Webhook secret** deve estar configurado na Vercel (`MERCADOPAGO_WEBHOOK_SECRET`)
5. **Redirect OAuth** deve apontar para `{NEXT_PUBLIC_APP_URL}/api/mercadopago/callback`

### 5.4 Webhook — pontos fortes

- ✅ Validação HMAC com `timingSafeEqual`
- ✅ Consulta status real na API MP (não confia só no payload)
- ✅ Reconciliação de valor (bloqueia aprovação se amount ≠ grossValue)
- ✅ Idempotência (status final ignorado)
- ✅ Libera estoque em cancelamento/rejeição
- ✅ GET health check + simulação MP (id `123456`) retorna 200

### 5.5 Webhook — lacunas

- ❌ **Não dispara e-mail** após `APPROVED`
- ❌ Não registra log estruturado (Sentry/Datadog)
- ⚠️ Usa token da **plataforma** para buscar payment criado com token do **organizador** — funciona em marketplace, mas deve ser monitorado

---

## 6. Envio de ingresso por e-mail — LACUNA CRÍTICA

### 6.1 Situação atual

**Não existe nenhum sistema de e-mail transacional.**

- ❌ Sem `nodemailer`, Resend, SendGrid, AWS SES ou similar nas dependências
- ❌ Sem templates de e-mail
- ❌ Sem envio após pagamento aprovado (webhook ou `/api/payments/process`)
- ❌ Sem envio para ingressos gratuitos confirmados
- ❌ Sem recuperação de senha por e-mail
- ❌ Sem notificação ao organizador de nova venda

O e-mail aparece apenas como:
- Campo de identificação do usuário
- E-mail do pagador no Mercado Pago
- Consulta manual em `/meus-ingressos`

### 6.2 O que falta implementar (mínimo produção)

| # | Item | Prioridade |
|---|------|------------|
| 1 | Provedor de e-mail (Resend recomendado — simples na Vercel) | P0 |
| 2 | Variáveis: `RESEND_API_KEY`, `EMAIL_FROM` | P0 |
| 3 | Template HTML: confirmação de ingresso | P0 |
| 4 | Disparo no webhook `handleApproved()` e em pagamento cartão aprovado síncrono | P0 |
| 5 | Disparo em inscrição gratuita (`/api/enroll`) | P1 |
| 6 | Anexo PDF ou link para ingresso digital | P1 |
| 7 | Idempotência (não reenviar e-mail duplicado) | P1 |
| 8 | Fila/retry em caso de falha de envio | P2 |

### 6.3 Conteúdo sugerido do e-mail de ingresso

- Nome do participante
- Número da inscrição (`#ordemCompra`)
- Evento, data, local
- Tipo de ingresso
- Valor pago
- QR Code para check-in (quando implementado)
- Link para `/meus-ingressos`

---

## 7. Ingresso digital e check-in

| Funcionalidade | Status |
|----------------|--------|
| Número sequencial `ordemCompra` | ✅ Existe no banco |
| QR Code de check-in | ❌ Não implementado |
| PDF de ingresso | ❌ Não implementado |
| Página de ingresso individual | ❌ Não existe (`/ingresso/[id]`) |
| Validação check-in (scanner) | ❌ Não existe |
| Status `CHECKED_IN` no schema | ✅ Existe, sem UI |

O schema menciona QR para check-in, mas **nenhum código gera ou valida QR**.

---

## 8. Funcionalidades por módulo

### 8.1 ✅ Prontas ou quase prontas

- Home com busca, categorias, patrocinadores
- Criação/edição de eventos (organizador + admin)
- Formulário dinâmico por evento (`formStructure`)
- Inscrição com controle de estoque (transação Prisma)
- Ingressos gratuitos (confirmação imediata)
- Checkout embarcado Mercado Pago (cartão, PIX, boleto)
- Split marketplace Moove 5,5%
- OAuth conectar/desconectar MP no dashboard
- Webhook com segurança
- Meus ingressos (consulta por e-mail)
- Export CSV de participantes
- Patrocinadores (evento + plataforma)
- Auth por credenciais (admin/organizador)
- CI (lint + test + build)

### 8.2 ⚠️ Parciais

- PIX ao reabrir checkout pendente (depende StatusScreen, sem cache PIX)
- Página `/payment/success` (genérica, não mostra dados do ingresso)
- Testes (só `fee.test.ts` e `home-query.test.ts`)
- Mídias em base64 no banco (funciona, risco de bloat)
- Rate limiting em APIs públicas (`/api/enroll`, `/api/my-tickets`)

### 8.3 ❌ Ausentes (bloqueiam 100%)

- **E-mail transacional pós-pagamento**
- Ingresso PDF/QR digital
- Check-in no evento
- Recuperação de senha
- Monitoramento/alertas (Sentry)
- Testes E2E do fluxo de pagamento
- Storage externo para imagens (S3/Cloudinary upload server-side)

---

## 9. Variáveis de ambiente (produção)

| Variável | Obrigatória | Configurada? |
|----------|-------------|--------------|
| `DATABASE_URL` | Sim | ✅ Vercel |
| `DIRECT_URL` | Sim (migrations) | ✅ |
| `AUTH_SECRET` | Sim | ✅ |
| `MERCADOPAGO_ACCESS_TOKEN` | Sim | ✅ |
| `MERCADOPAGO_CLIENT_ID` | Sim | ✅ |
| `MERCADOPAGO_CLIENT_SECRET` | Sim | ✅ |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Sim | ✅ |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sim | ✅ |
| `NEXT_PUBLIC_APP_URL` | Sim | ✅ |
| `RESEND_API_KEY` ou similar | **Falta** | ❌ |
| `EMAIL_FROM` | **Falta** | ❌ |

---

## 10. Segurança

| Item | Status |
|------|--------|
| Fees calculadas no servidor | ✅ |
| Webhook HMAC | ✅ |
| Reconciliação de valor | ✅ |
| Middleware por role | ✅ |
| POST `/api/events` protegido | ✅ (corrigido desde auditoria anterior) |
| Dashboard filtra por organizerId | ✅ |
| Tokens OAuth MP no servidor only | ✅ |
| Rate limiting | ❌ |
| CSRF em forms | N/A (API JSON) |
| Secrets no repositório | ⚠️ Verificar — nunca commitar `.env.local` |

---

## 11. Testes e CI

| Tipo | Cobertura |
|------|-----------|
| Unitário `fee.ts` | ✅ 5,5%, arredondamento |
| Unitário `home-query.ts` | ✅ URLs e OAuth state |
| Smoke `scripts/smoke-home.ts` | ✅ Seed + APIs home |
| Integração pagamento | ❌ |
| E2E checkout PIX | ❌ |
| CI GitHub Actions | ✅ lint + test + build |

---

## 12. Roadmap para produção 100%

### Fase 1 — Bloqueadores imediatos (P0)

| # | Tarefa | Esforço |
|---|--------|---------|
| 1 | **Implementar e-mail de confirmação de ingresso** (Resend + template + webhook) | 1–2 dias |
| 2 | Regularizar conta MP do organizador Colégio Omega (painel MP) | Operacional |
| 3 | Garantir todos organizadores conectaram MP antes de vender ingresso pago | Operacional |
| 4 | Testar fluxo PIX completo em produção (e-mail → pagar → QR → webhook → confirmado) | 2–4 h |
| 5 | Corrigir comentários/docs que ainda citam taxa 2% | 1 h |

### Fase 2 — Experiência do comprador (P1)

| # | Tarefa | Esforço |
|---|--------|---------|
| 6 | Página `/payment/success` com dados reais do ingresso (busca por `external_reference`) | 4 h |
| 7 | Ingresso digital: QR code + página `/ingresso/[ordemCompra]` | 1–2 dias |
| 8 | E-mail também para ingresso gratuito | 2 h |
| 9 | Fetch PIX ao reabrir checkout pendente (API GET payment status) | 4 h |
| 10 | Rate limiting em `/api/enroll` e `/api/my-tickets` | 4 h |

### Fase 3 — Operação e qualidade (P2)

| # | Tarefa | Esforço |
|---|--------|---------|
| 11 | Sentry ou similar para erros de pagamento/webhook | 4 h |
| 12 | Testes E2E (Playwright) fluxo inscrição + checkout | 2–3 dias |
| 13 | Upload de imagens para storage externo (Cloudinary/S3) | 1–2 dias |
| 14 | Check-in scanner para organizador | 2–3 dias |
| 15 | Notificação ao organizador (nova venda por e-mail) | 4 h |

---

## 13. Checklist go-live 100%

```
Infraestrutura
[✅] Deploy Vercel produção
[✅] PostgreSQL (Neon/similar)
[✅] Migrations aplicadas
[✅] Variáveis MP configuradas
[✅] Webhook MP apontando para /api/webhooks/mercadopago
[❌] Provedor de e-mail configurado

Pagamentos
[✅] OAuth marketplace configurado
[⚠️] Organizadores com conta MP habilitada para receber
[✅] Checkout embarcado (Payment Brick)
[✅] PIX QR + copia e cola
[✅] Webhook HMAC + reconciliação
[❌] Teste ponta a ponta documentado em produção

Pós-venda
[❌] E-mail automático com ingresso após pagamento
[❌] PDF ou QR de ingresso
[⚠️] Meus ingressos (consulta manual funciona)

Qualidade
[✅] CI passando
[⚠️] Cobertura de testes mínima
[❌] Monitoramento de erros
[❌] Rate limiting
```

---

## 14. Conclusão

O **EventosOmega** é uma plataforma funcional e bem estruturada para venda de ingressos com split Mercado Pago. O núcleo (inscrição, estoque, checkout embarcado, webhook, PIX com QR) **está implementado**.

Para atingir **produção 100%** com todas as funcionalidades solicitadas:

1. **E-mail de ingresso após pagamento** — maior lacuna; zero implementado hoje
2. **Conta MP do organizador habilitada** — bloqueio operacional em produção
3. **Ingresso digital (QR/PDF)** — complemento essencial ao e-mail
4. **Testes e monitoramento** — confiança operacional

**Prioridade #1:** implementar serviço de e-mail + disparo no webhook `APPROVED` e no fluxo de cartão aprovado.

---

*Auditoria gerada em 22/05/2026 — EventosOmega v0.1.0*
