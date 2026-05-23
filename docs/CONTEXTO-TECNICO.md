# EventosOmega — Documento de Contexto Técnico

**Última atualização:** 22/05/2026  
**Repositório:** https://github.com/caiomktdev/eventos-omega  
**Produção:** https://eventos-omega-six.vercel.app  
**Stack:** Next.js 16.2.6 · React 19 · Prisma 5.22 · PostgreSQL · Auth.js v5 · Mercado Pago · Resend  

> Documento único de referência: auditoria holística, estado atual, riscos, plano de sprints e instruções de implementação.  
> Substitui `AUDITORIA-TECNICA.md` (22/05/2026, desatualizado) e `EventosOmega-Contexto-Tecnico.doc`.

---

## Índice

1. [Sumário executivo](#1-sumário-executivo)
2. [Inventário do codebase](#2-inventário-do-codebase)
3. [Arquitetura e fluxos](#3-arquitetura-e-fluxos)
4. [Regra financeira (Moove)](#4-regra-financeira-moove)
5. [Funcionalidades — status atual](#5-funcionalidades--status-atual)
6. [Auditoria de segurança](#6-auditoria-de-segurança)
7. [Performance e UX](#7-performance-e-ux)
8. [Débitos técnicos e código morto](#8-débitos-técnicos-e-código-morto)
9. [Testes e CI/CD](#9-testes-e-cicd)
10. [Variáveis de ambiente](#10-variáveis-de-ambiente)
11. [Plano de ação — 3 Sprints](#11-plano-de-ação--3-sprints)
12. [Inicialização imediata (P0)](#12-inicialização-imediata-p0)
13. [Checklist production-ready](#13-checklist-production-ready)
14. [Referência rápida de APIs e páginas](#14-referência-rápida-de-apis-e-páginas)

---

## 1. Sumário executivo

### Prontidão geral: ~68–72%

| Área | Status | Prontidão |
|------|--------|-----------|
| Vitrine pública + inscrição | ✅ Funcional | 95% |
| Painel organizador + admin | ✅ Funcional | 90% |
| Mercado Pago marketplace (OAuth split) | ⚠️ Parcial | 75% |
| Checkout embarcado (cartão/PIX/boleto) | ⚠️ Parcial | 80% |
| PIX (QR + copia e cola) | ✅ Implementado | 85% |
| Webhook + confirmação de pagamento | ✅ Implementado | 90% |
| E-mail de ingresso (Resend) | ✅ Implementado | 75% |
| Ingresso digital / check-in | ❌ Ausente | 0% |
| Job de expiração de estoque | ❌ Ausente | 0% |
| Rate limiting | ❌ Ausente | 0% |
| Testes automatizados | ⚠️ Mínimo | 25% |
| Observabilidade / storage externo | ❌ Ausente | 10% |

### Veredito

O **núcleo comercial está operacional**: inscrição, checkout embarcado, PIX, webhook, split 5,5% e e-mail de confirmação. **Não está production-ready enterprise** por: estoque abandonado sem liberação, webhook que engole falhas, APIs sem rate limit, success page não confiável, ausência de ingresso digital/check-in e cobertura de testes mínima.

### Maiores riscos (P0)

1. **Estoque:** `soldQuantity++` na inscrição; decremento só em webhook REJECTED/CANCELLED — reservas PENDING abandonadas **bloqueiam vagas para sempre**.
2. **Webhook:** erro de DB retorna HTTP 200 — Mercado Pago não reenvia.
3. **Abuso:** `/api/enroll`, `/api/my-tickets`, `/api/checkout` sem rate limiting.
4. **Documentação:** comentários citam taxa **2%**; código aplica **5,5%**.
5. **Operacional:** conta MP do organizador precisa estar habilitada para receber (ex.: Colégio Omega).

---

## 2. Inventário do codebase

### Métricas

| Métrica | Valor |
|---------|------:|
| Arquivos TS/TSX (`src/`, `prisma/`, `scripts/`) | ~127 |
| Linhas de código (aprox.) | ~17.600 |
| Rotas API (`route.ts`) | 25 |
| Páginas App Router | 19 |
| Módulos `src/lib/` | 15 |
| Migrations Prisma | 6 |
| Testes unitários | 2 arquivos |

### Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind 3, Shadcn/ui, Lucide
- **Backend:** Route Handlers, Prisma ORM, PostgreSQL
- **Auth:** Auth.js v5 (Credentials, JWT, roles ADMIN/ORGANIZER/BUYER)
- **Pagamentos:** Mercado Pago SDK + `@mercadopago/sdk-react` (Payment Brick, StatusScreen)
- **E-mail:** Resend (`src/lib/email/`)
- **Deploy:** Vercel (região `gru1`), GitHub Actions CI

### Estrutura principal

```
src/
├── app/
│   ├── admin/(panel)/     # Painel administrativo
│   ├── api/               # 25 route handlers
│   ├── checkout/[id]/     # Checkout embarcado
│   ├── dashboard/         # Painel organizador
│   ├── event/[slug]/      # Página pública + inscrição
│   ├── meus-ingressos/
│   └── payment/{success,failure}/
├── auth.config.ts, auth.ts, middleware.ts
├── components/            # admin, checkout, dashboard, events, ui...
├── hooks/                 # use-toast, use-transaction (não usado)
├── lib/                   # fee, mercadopago, email, validations...
└── types/
prisma/
├── schema.prisma
└── migrations/            # 6 migrations
docs/
└── CONTEXTO-TECNICO.md    # este documento
```

### Modelos Prisma

| Modelo | Papel |
|--------|-------|
| `User` | ADMIN / ORGANIZER / BUYER + tokens OAuth MP |
| `Event` | Evento + `formStructure` JSON dinâmico |
| `TicketType` | Tipos de ingresso + estoque (`soldQuantity`) |
| `Participant` | Inscrição + `ordemCompra` + `formData` + `confirmationEmailSentAt` |
| `Transaction` | grossValue, mooveFee, organizerNetValue, status MP |
| `EventSponsorMedia` | Patrocinadores por evento |
| `PlatformSponsor` / `PlatformBannerMedia` | Home |

---

## 3. Arquitetura e fluxos

### 3.1 Inscrição e pagamento

```
Comprador → /event/[slug] → POST /api/enroll
  → Participant (REGISTERED) + Transaction (PENDING)
  → soldQuantity++
  → redirect /checkout/{participantId}

/checkout/[id] → EmbeddedPaymentCheckout (Payment Brick)
  → POST /api/checkout (Preference MP, marketplace_fee)
  → POST /api/payments/process (Payment MP, application_fee)

PIX pendente:
  → API retorna qr_code + qr_code_base64
  → PixPaymentDisplay (QR + copiar)

Cartão aprovado:
  → redirect /payment/success
  → sendTicketConfirmationEmailAsync()

Mercado Pago → POST /api/webhooks/mercadopago
  → HMAC-SHA256 + reconciliação de valor
  → APPROVED → Participant CONFIRMED + e-mail
  → REJECTED/CANCELLED → soldQuantity--
```

### 3.2 Split marketplace (Moove)

| Etapa | Token | Campo split |
|-------|-------|-------------|
| Preference (Brick init) | OAuth organizador | `marketplace_fee` |
| Payment (Brick submit) | OAuth organizador | `application_fee` |
| Webhook consulta | Token plataforma Moove | — |

Organizador conecta MP em `/dashboard` via OAuth (`/api/mercadopago/connect`).

### 3.3 E-mail transacional

| Trigger | Arquivo |
|---------|---------|
| Webhook APPROVED | `webhooks/mercadopago/route.ts` |
| Cartão aprovado síncrono | `payments/process/route.ts` |
| Ingresso gratuito | `enroll/route.ts` |

Módulo: `src/lib/email/ticket-confirmation.ts`  
Idempotência: `Participant.confirmationEmailSentAt`  
Skip silencioso se `RESEND_API_KEY` ausente (log warn).

### 3.4 Auth e middleware

```typescript
// src/middleware.ts — protege apenas páginas UI
matcher: ["/admin/:path*", "/dashboard/:path*"]
// APIs: auth manual por rota (sem middleware centralizado)
```

---

## 4. Regra financeira (Moove)

### Fonte da verdade

```typescript
// src/lib/fee.ts
const MOOVE_FEE_RATE = 0.055; // 5,5%
```

- Cálculo **somente no servidor** (`calculateMooveFee()` em centavos)
- Cliente **nunca** envia valores monetários
- `marketplace_fee` / `application_fee` derivados de `Transaction.mooveFee`

### Inconsistência documental (débito)

Comentários ainda citam **2%** em: `schema.prisma`, `enroll/route.ts`, `checkout/route.ts`, `checkout/[id]/page.tsx`, `event/[slug]/page.tsx`. **Corrigir na Sprint 1.**

---

## 5. Funcionalidades — status atual

### ✅ Implementado

- Home, busca, categorias, patrocinadores, FAQ
- CRUD eventos (organizador + admin), formulário dinâmico
- Inscrição com estoque transacional, limite por e-mail
- Ingresso gratuito → CONFIRMED imediato
- Checkout embarcado MP (cartão, PIX, boleto)
- PIX: QR + copia e cola + erros visíveis
- Webhook HMAC, reconciliação, idempotência
- E-mail confirmação ingresso (Resend)
- Meus ingressos por e-mail
- Export CSV participantes
- OAuth MP connect/disconnect
- CI: lint + test + build
- Deploy: migrate automático no build (`vercel.json`)

### ⚠️ Parcial

- `/payment/success` — sucesso só por query string, sem validar DB
- Polling pós-PIX — hook `use-transaction.ts` existe mas não usado
- Reabrir QR PIX pendente — StatusScreen; sem API dedicada de status
- Mídias em base64 no PostgreSQL

### ❌ Ausente

- Job expiração reservas / liberação estoque abandonado
- Rate limiting
- Ingresso digital (PDF/QR check-in)
- UI check-in (`CHECKED_IN` no schema, sem tela)
- E-mail: pendente PIX, recusado, reembolso, lembrete evento
- Notificação organizador (nova venda)
- Refund via API
- Sentry / logger estruturado
- Storage externo (S3/Cloudinary)
- Recuperação de senha
- `loading.tsx` / `error.tsx` globais
- Testes integração / E2E

---

## 6. Auditoria de segurança

### Pontos fortes

| Controle | Implementação |
|----------|---------------|
| Taxa no servidor | `calculateMooveFee()` — imutável |
| Webhook HMAC | `timingSafeEqual` em produção |
| Reconciliação valor | Bloqueia APPROVED se amount ≠ grossValue |
| Idempotência webhook | Ignora status final |
| OAuth state | Cookie + state assinado |
| Ownership admin | `canManageEvent()`, `canManageParticipant()` |
| SQL injection | Prisma only — sem raw SQL |
| Secrets | MP tokens, Resend — server only |
| Chave MP pública | Apenas `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` |

### Gaps por severidade

| # | Gap | Sev. |
|---|-----|------|
| 1 | Sem rate limiting em APIs públicas | P0 |
| 2 | Estoque vazado (PENDING abandonado) | P0 |
| 3 | Webhook retorna 200 em falha de DB | P0 |
| 4 | Enumeração via `/api/my-tickets?email=` | P1 |
| 5 | IDOR `/checkout/[participantId]` | P1 |
| 6 | HMAC desligado fora de `production` | P1 |
| 7 | `/payment/success` não confiável | P2 |
| 8 | Middleware não cobre `/api/*` | P2 |
| 9 | Sem CSP/HSTS/X-Frame-Options | P2 |
| 10 | Body limit 20MB (upload base64) | P2 |
| 11 | enroll → HTTP interno para checkout | P2 |

### console.* em produção

- `console.log`: apenas seed e smoke script
- `console.error`: ~35× em API routes — sem logger estruturado
- `console.warn`: webhook, e-mail sem Resend
- **Nenhum** `catch {}` vazio

---

## 7. Performance e UX

### Performance

| Issue | Impacto |
|-------|---------|
| Base64 em `@db.Text` (capas, logos) | DB inchado, queries lentas |
| Over-fetching dashboards admin | Todos participantes CONFIRMED por evento |
| HTTP interno enroll→checkout | Latência + ponto de falha |
| Falta índice composto em participants | Check limite por e-mail |

### UX — feedback visual

| ✅ | ❌ |
|----|-----|
| Loaders checkout embarcado | `loading.tsx` / `error.tsx` em rotas |
| Suspense na home | Loaders dashboard/admin |
| Erros visíveis PIX | Toast consistente admin |
| Empty states na maioria das listas | Feedback e-mail falhou ao usuário |

---

## 8. Débitos técnicos e código morto

### Código morto (confirmado)

| Artefato | Arquivo | Motivo |
|----------|---------|--------|
| `RetryPaymentButton` | `components/checkout/retry-payment-button.tsx` | Nunca importado; fluxo Checkout Pro obsoleto |
| `useTransaction` | `hooks/use-transaction.ts` | Nunca importado; polling sem email param |
| Tipos órfãos | `types/index.ts` | `ParticipantWithDetails`, `TicketSelection`, `CheckoutSummary`, `CheckoutPreferenceResponse` |

### Outros débitos

- `POST /api/events` publica como PUBLISHED; `POST /api/admin/events` cria DRAFT — fluxos conflitantes
- Seed loga credenciais hardcoded (`Admin@2026!`) — risco se rodar fora de dev
- TODO/FIXME/HACK: **zero** marcadores reais no código

---

## 9. Testes e CI/CD

### Existente

| Teste | Arquivo |
|-------|---------|
| Fee 5,5% | `src/lib/fee.test.ts` |
| Home query + OAuth state | `src/lib/home-query.test.ts` |
| Smoke manual | `scripts/smoke-home.ts` |

### CI (`.github/workflows/ci.yml`)

Push/PR em `main`: `npm ci` → `prisma generate` → `lint` → `test` → `build`

### Ausente (prioridade)

- Integração: enroll, webhook, payments/process
- E2E: inscrição → PIX → webhook → e-mail
- Auth guards, idempotência e-mail
- Smoke no CI

### Deploy (`vercel.json`)

```json
{
  "buildCommand": "prisma generate && DIRECT_URL=\"${DIRECT_URL:-$DATABASE_URL}\" prisma migrate deploy && next build",
  "framework": "nextjs",
  "regions": ["gru1"]
}
```

---

## 10. Variáveis de ambiente

| Variável | Obrigatória | Uso |
|----------|:-----------:|-----|
| `DATABASE_URL` | Sim | Prisma (pooled) |
| `DIRECT_URL` | Sim | Migrations |
| `AUTH_SECRET` | Sim | Auth.js JWT |
| `MERCADOPAGO_ACCESS_TOKEN` | Sim | Plataforma Moove |
| `MERCADOPAGO_CLIENT_ID/SECRET` | Sim | OAuth |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Sim | Payment Brick |
| `MERCADOPAGO_WEBHOOK_SECRET` | Prod | HMAC webhook |
| `NEXT_PUBLIC_APP_URL` | Sim | back_urls, OAuth, webhook |
| `RESEND_API_KEY` | Prod* | E-mail ingresso |
| `EMAIL_FROM` | Prod* | Remetente Resend |
| `DEMO_ORGANIZER_ID` | Dev | Admin cria evento em dev |
| `CRON_SECRET` | Sprint 1 | Proteger cron jobs |
| `SMOKE_BASE_URL` | Opcional | Smoke script |

\* E-mail skip silencioso se ausente — pagamentos não afetados.

### Webhook produção

URL: `https://eventos-omega-six.vercel.app/api/webhooks/mercadopago`  
OAuth redirect: `{NEXT_PUBLIC_APP_URL}/api/mercadopago/callback`

### Seed (dev only)

| Papel | E-mail | Senha |
|-------|--------|-------|
| Admin | admin@eventosomega.com | Admin@2026! |
| Organizador | organizer@eventosomega.com | Org@2026! |

---

## 11. Plano de ação — 3 Sprints

### Sprint 1: Estabilidade Financeira e Integridade de Estoque
**P0 — 5–7 dias**

**Objetivo:** Eliminar perda de estoque, falhas silenciosas no webhook e abuso de APIs.

#### Backend / Banco

| # | Tarefa |
|---|--------|
| 1.1 | Job expiração reservas (`reservationExpiresAt` + cron Vercel) |
| 1.2 | Webhook: 502 em falha DB (não 200 silencioso) |
| 1.3 | Rate limiting (Upstash ou equivalente) |
| 1.4 | Validar `/payment/success` contra banco |
| 1.5 | Bloquear publish evento pago sem MP conectado |
| 1.6 | Extrair checkout para lib (eliminar HTTP interno enroll) |
| 1.7 | Índices Prisma (participants, transactions) |

#### Frontend / UI

| # | Tarefa |
|---|--------|
| 1.8 | Success page com dados reais |
| 1.9 | UX reserva expirada no checkout |
| 1.10 | Banner MP não conectado no dashboard |

#### Débitos

| # | Tarefa |
|---|--------|
| 1.11 | Alinhar taxa 5,5% em todos comentários/UI |
| 1.12 | Atualizar este documento após entrega |
| 1.13 | `CRON_SECRET` no `.env.example` |
| 1.14 | Testes `release-expired.ts` |

---

### Sprint 2: Experiência Completa do Comprador
**P1 — 7–10 dias**

**Objetivo:** Ingresso digital, check-in, e-mails complementares, UX robusta.

#### Backend / Banco

| # | Tarefa |
|---|--------|
| 2.1 | `checkInToken` (UUID) em Participant |
| 2.2 | `GET /api/tickets/[token]` |
| 2.3 | `POST /api/admin/events/[id]/check-in` |
| 2.4 | E-mail PIX pendente |
| 2.5 | E-mail recusado/expirado |
| 2.6 | E-mail nova venda (organizador) |
| 2.7 | `GET /api/payments/status?participantId=` |

#### Frontend / UI

| # | Tarefa |
|---|--------|
| 2.8 | Página `/ingresso/[token]` com QR |
| 2.9 | QR no template e-mail |
| 2.10 | Polling pós-PIX no checkout |
| 2.11 | `loading.tsx` + `error.tsx` |
| 2.12 | Tela check-in organizador |
| 2.13 | Unificar `POST /api/events` vs admin |

#### Débitos

| # | Tarefa |
|---|--------|
| 2.14 | Remover `retry-payment-button`, tipos órfãos |
| 2.15 | Reescrever `use-transaction` ou remover |
| 2.16 | Testes integração webhook + enroll |
| 2.17 | Documentar fluxo no README |

---

### Sprint 3: Escala, Observabilidade e Hardening
**P2/P3 — 10–14 dias**

**Objetivo:** Sistema observável, mídias escaláveis, E2E, segurança reforçada.

#### Backend / Infra

| # | Tarefa |
|---|--------|
| 3.1 | Cloudinary/S3 para mídias |
| 3.2 | Logger Pino + Sentry |
| 3.3 | Refund API ou runbook |
| 3.4 | Middleware auth centralizado `/api/admin/*` |
| 3.5 | Security headers (`next.config.ts`) |
| 3.6 | Paginação dashboards admin |

#### Frontend

| # | Tarefa |
|---|--------|
| 3.7 | `ImageUpload` compartilhado |
| 3.8 | Dashboard financeiro paginado |
| 3.9 | Painel ops (webhooks/e-mails falhos) |
| 3.10 | Recuperação de senha |

#### Qualidade

| # | Tarefa |
|---|--------|
| 3.11 | E2E Playwright |
| 3.12 | Smoke no CI |
| 3.13 | Staging + MP sandbox |
| 3.14 | Runbook operacional |

---

## 12. Inicialização imediata (P0)

### Primeiro passo: Job de Expiração de Estoque

**Prioridade:** maior risco de negócio (vagas bloqueadas permanentemente).

**Ordem de implementação:**

1. `prisma/schema.prisma` — `reservationExpiresAt` + índice
2. `src/lib/reservations/release-expired.ts` — lógica testável
3. `src/app/api/enroll/route.ts` — TTL 30min em inscrições pagas
4. `src/app/api/cron/release-expired-reservations/route.ts`
5. `vercel.json` — cron `*/5 * * * *`
6. Env: `CRON_SECRET`

#### Schema (Transaction)

```prisma
  reservationExpiresAt DateTime?

  @@index([status, reservationExpiresAt])
```

#### Lógica core (`release-expired.ts`)

```typescript
export async function releaseExpiredReservations(now = new Date()) {
  const expired = await prisma.transaction.findMany({
    where: {
      status: "PENDING",
      reservationExpiresAt: { lt: now },
      participant: { status: "REGISTERED" },
    },
    select: { id: true, participantId: true, participant: { select: { ticketTypeId: true } } },
    take: 200,
  });

  const participantIds: string[] = [];

  for (const tx of expired) {
    await prisma.$transaction(async (db) => {
      const current = await db.participant.findUnique({
        where: { id: tx.participantId },
        select: { status: true, ticketTypeId: true },
      });
      if (!current || current.status !== "REGISTERED") return;

      await db.transaction.update({ where: { id: tx.id }, data: { status: "CANCELLED" } });
      await db.participant.update({ where: { id: tx.participantId }, data: { status: "CANCELLED" } });
      await db.ticketType.update({
        where: { id: current.ticketTypeId },
        data: { soldQuantity: { decrement: 1 } },
      });
      participantIds.push(tx.participantId);
    });
  }

  return { released: participantIds.length, participantIds };
}
```

#### Enroll (inscrição paga)

```typescript
const RESERVATION_TTL_MS = 30 * 60 * 1000;

transaction: {
  create: {
    // ...campos existentes
    status: isFree ? "APPROVED" : "PENDING",
    ...(!isFree && { reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS) }),
  },
},
```

#### Cron route

```typescript
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseExpiredReservations();
  return NextResponse.json({ ok: true, ...result });
}
```

#### vercel.json (crons)

```json
"crons": [{ "path": "/api/cron/release-expired-reservations", "schedule": "*/5 * * * *" }]
```

### Segundo passo (mesma sessão): Webhook

Arquivo: `src/app/api/webhooks/mercadopago/route.ts`  
Alterar catch final: retornar **502** quando falha ao persistir no banco (permitir retry MP).

### Teste local

```bash
cd /Users/caiohenrique/Desktop/EventosOmega
npx prisma migrate dev --name add_reservation_expires_at
npm run dev

curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/release-expired-reservations
```

---

## 13. Checklist production-ready

### Infraestrutura
- [x] Deploy Vercel produção
- [x] PostgreSQL configurado
- [x] Migrations no build
- [x] Webhook MP configurado
- [x] Resend (produção)
- [ ] CRON_SECRET + job expiração
- [ ] Rate limiting
- [ ] Sentry/monitoramento

### Pagamentos
- [x] OAuth marketplace
- [x] Checkout embarcado + PIX QR
- [x] Webhook HMAC
- [ ] Organizadores MP habilitados
- [ ] Teste E2E documentado

### Pós-venda
- [x] E-mail confirmação
- [ ] Ingresso digital QR
- [ ] Check-in
- [x] Meus ingressos (consulta manual)

### Qualidade
- [x] CI lint/test/build
- [ ] Testes integração
- [ ] E2E
- [ ] Runbook ops

---

## 14. Referência rápida de APIs e páginas

### APIs públicas (sem auth)

| Rota | Método | Função |
|------|--------|--------|
| `/api/enroll` | POST | Inscrição |
| `/api/checkout` | POST | Preference MP |
| `/api/payments/process` | POST | Payment Brick |
| `/api/webhooks/mercadopago` | GET/POST | IPN MP |
| `/api/my-tickets` | GET | Ingressos por e-mail |
| `/api/events` | GET | Lista eventos |
| `/api/events/featured` | GET | Destaques home |

### Páginas principais

| Rota | Função |
|------|--------|
| `/` | Home |
| `/event/[slug]` | Evento + inscrição |
| `/checkout/[id]` | Pagamento embarcado |
| `/meus-ingressos` | Consulta comprador |
| `/dashboard` | Organizador |
| `/admin` | Administrador |

### Arquivos críticos de pagamento

| Arquivo | Função |
|---------|--------|
| `src/lib/fee.ts` | Taxa 5,5% |
| `src/lib/mercadopago-oauth.ts` | OAuth organizador |
| `src/app/api/webhooks/mercadopago/route.ts` | Webhook |
| `src/components/checkout/embedded-payment-checkout.tsx` | Payment Brick |
| `src/components/checkout/pix-payment-display.tsx` | QR PIX |
| `src/lib/email/ticket-confirmation.ts` | E-mail ingresso |

---

## Histórico de commits relevantes

| Commit | Descrição |
|--------|-----------|
| `feat(checkout)` | Payment Brick embarcado |
| `fix(checkout)` | QR PIX + erros visíveis |
| `feat(email)` | Resend + confirmationEmailSentAt |
| `chore(vercel)` | migrate deploy no build |
| `docs` | Auditoria 22/05/2026 |

---

*Documento mantido pela equipe de engenharia EventosOmega. Atualizar ao concluir cada Sprint.*
