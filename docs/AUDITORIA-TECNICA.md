# Relatório de Auditoria Técnica — EventosOmega

**Data:** 20/05/2026  
**Versão analisada:** Next.js 16.2.6 (Turbopack) + Prisma 5.22 + Auth.js v5 beta.25  
**Escopo:** Varredura completa do repositório — rotas, endpoints, componentes, segurança e lacunas

---

## Sumário

1. [Árvore de Arquivos e Limpeza](#1-árvore-de-arquivos-e-limpeza)
2. [Mapeamento de Endpoints e Regras Financeiras](#2-mapeamento-de-endpoints-e-regras-financeiras)
3. [Diagnóstico de Componentes e Interface](#3-diagnóstico-de-componentes-e-interface)
4. [Lacunas e Pontos Quebrados](#4-lacunas-e-pontos-quebrados)
5. [Resumo Executivo](#5-resumo-executivo)

---

## 1. Árvore de Arquivos e Limpeza

### 1.1 Estrutura atual real

```
src/
├── app/
│   ├── admin/
│   │   ├── dashboard/page.tsx          ✅ Dashboard financeiro (KPIs)
│   │   ├── events/
│   │   │   ├── [id]/
│   │   │   │   ├── edit/page.tsx       ✅ Edição de evento
│   │   │   │   └── page.tsx            ✅ Detalhe do evento
│   │   │   └── new/page.tsx            ⚠️ DUPLICAÇÃO (usa AdminEventForm, não o Sympla)
│   │   ├── layout.tsx                  ✅ Atualizado (auth() + SignOutButton)
│   │   ├── login/page.tsx              ✅ Login unificado
│   │   └── page.tsx                    ✅ Painel de eventos
│   ├── api/
│   │   ├── admin/events/[id]/
│   │   │   ├── export/route.ts         ✅ Export CSV de participantes
│   │   │   └── route.ts                ✅ GET + PATCH + DELETE
│   │   ├── admin/events/route.ts       ✅ GET + POST (protegido via middleware)
│   │   ├── admin/participants/[id]/route.ts  ✅
│   │   ├── auth/[...nextauth]/route.ts ✅ Handlers Auth.js v5
│   │   ├── checkout/route.ts           ✅ COMPLETO
│   │   ├── enroll/route.ts             ✅ COMPLETO
│   │   ├── events/route.ts             ⚠️ POST SEM AUTH (qualquer cliente pode criar evento)
│   │   ├── participants/[id]/transaction/route.ts ✅ Polling de transação
│   │   └── webhooks/mercadopago/route.ts ✅ COMPLETO
│   ├── checkout/[id]/page.tsx          ✅ Retry de pagamento
│   ├── dashboard/
│   │   ├── events/new/page.tsx         ✅ Usa CreateEventForm (Sympla, 7 seções)
│   │   └── page.tsx                    ⚠️ Não filtra por organizerId
│   ├── event/[slug]/page.tsx           ✅ Página pública (2 colunas, Sympla)
│   ├── events/[id]/page.tsx            ✅ Redirect 308 → /event/[slug]
│   ├── payment/{failure,success}/      ✅ Páginas pós-pagamento
│   └── page.tsx                        ✅ Home com busca server-side
│
├── auth.config.ts                      ✅ Edge-compatible (middleware)
├── auth.ts                             ✅ Node.js full (CredentialsProvider)
├── middleware.ts                       ✅ Proteção por role (src/middleware.ts)
│
├── components/
│   ├── admin/
│   │   ├── admin-event-form.tsx        ✅ Formulário edição/criação admin
│   │   ├── event-filter.tsx            ✅
│   │   ├── event-status-actions.tsx    ✅
│   │   ├── form-builder.tsx            ✅ Editor visual de formStructure
│   │   ├── participant-edit-dialog.tsx ✅
│   │   └── participant-table.tsx       ✅ Tabela funcional com busca e paginação
│   ├── auth/
│   │   ├── login-form.tsx              ✅
│   │   └── sign-out-button.tsx         ✅
│   ├── checkout/
│   │   └── retry-payment-button.tsx    ✅
│   ├── dashboard/
│   │   └── event-form.tsx              ❌ ARQUIVO MORTO
│   ├── events/
│   │   ├── create-event-form.tsx       ✅ Formulário Sympla (7 seções)
│   │   ├── dynamic-event-form.tsx      ✅ Formulário público de inscrição
│   │   ├── event-card.tsx              ✅ Card estilo Sympla
│   │   └── event-list.tsx              ✅ Grid responsivo
│   ├── home/category-nav.tsx           ✅
│   ├── navbar.tsx                      ✅
│   └── search-bar.tsx                  ✅
│
├── hooks/
│   ├── use-event-form.ts               ❌ ARQUIVO MORTO
│   ├── use-toast.ts                    ✅
│   └── use-transaction.ts              ✅ Polling de status de pagamento
│
└── lib/
    ├── fee.ts                          ✅ Fonte única da taxa Moove (2%)
    ├── mercadopago.ts                  ✅
    ├── prisma.ts                       ✅
    ├── utils.ts                        ✅
    └── validations.ts                  ⚠️ createOrderSchema: schema morto
```

### 1.2 Arquivos para deletar imediatamente

| Arquivo | Motivo |
|---|---|
| `src/components/dashboard/event-form.tsx` | Substituído por `create-event-form.tsx`. Zero importações no codebase. |
| `src/hooks/use-event-form.ts` | Zero consumidores no codebase. |
| `createOrderSchema` e `CreateOrderInput` em `src/lib/validations.ts` | Resquício do fluxo de "orders" deletado. Nenhum endpoint ou componente consome. |

### 1.3 Rotas legadas — status

| Rota | Status |
|---|---|
| `/events/[id]` | ✅ Mantida como redirect 308 permanente para `/event/[slug]` (SEO) |
| `/api/orders` | ✅ Removida (fluxo legado) |
| `/api/events/[id]` | ✅ Removida |
| `src/components/checkout/` (legado) | ✅ Removido (substituído por `retry-payment-button.tsx`) |

---

## 2. Mapeamento de Endpoints e Regras Financeiras

### 2.1 Mapa completo dos endpoints existentes

| Endpoint | Verbo(s) | Estado | Observações |
|---|---|---|---|
| `POST /api/enroll` | POST | ✅ **Completo** | Valida estoque, cria Participant + Transaction |
| `POST /api/checkout` | POST | ✅ **Completo** | Idempotência, recalcula taxa do banco |
| `POST /api/webhooks/mercadopago` | POST | ✅ **Completo** | HMAC SHA-256, reconciliação de valor, idempotência |
| `GET /api/events` | GET | ✅ Público | Lista eventos publicados |
| `POST /api/events` | POST | ⚠️ **SEM AUTH** | Cria evento sem verificar sessão |
| `GET/POST /api/admin/events` | GET, POST | ✅ Completo | Protegido via middleware (ADMIN) |
| `GET/PATCH/DELETE /api/admin/events/[id]` | 3 verbos | ✅ Completo | PATCH valida `totalQuantity >= soldQuantity` |
| `GET /api/admin/events/[id]/export` | GET | ✅ Completo | CSV com BOM UTF-8, colunas dinâmicas |
| `GET/PATCH /api/admin/participants/[id]` | GET, PATCH | ✅ Completo | |
| `GET /api/participants/[id]/transaction` | GET | ✅ Completo | Polling para página de sucesso |
| `GET/POST /api/auth/[...nextauth]` | GET, POST | ✅ Completo | Auth.js v5 handlers |

### 2.2 Análise da `calculateMooveFee()` — integridade financeira

**Localização:** `src/lib/fee.ts`

**Regra de negócio:**
- Taxa Moove fixa: `MOOVE_FEE_RATE = 0.02 as const` (2%)
- Cálculo em centavos (`Math.round(grossCents * 0.02)`) para evitar imprecisão de ponto flutuante
- Retorna: `{ grossAmount, mooveFee, organizerAmount, feeRateApplied }`

**Chamadas verificadas:**

| Local | Comportamento | Status |
|---|---|---|
| `POST /api/enroll` | Chama `calculateMooveFee(unitPriceCents / 100)` após buscar preço do banco | ✅ Correto |
| `POST /api/checkout` | Chama `calculateMooveFee(Number(ticketType.price))` a partir do Prisma | ✅ Correto |
| `DynamicEventForm` (client) | Importa `calculateMooveFee` para exibição visual da taxa | ⚠️ Apenas cosmético |

**Conclusão sobre risco de manipulação pelo cliente:**

O cliente **nunca envia valores monetários** para os endpoints críticos:
- `/api/enroll` recebe apenas `eventId`, `ticketTypeId` e `formData` (nome, email, campos extras)
- `/api/checkout` recebe apenas `participantId`
- O preço é sempre lido do banco (`TicketType.price`) e a taxa recalculada no servidor

**Risco identificado (baixo):** o `DynamicEventForm` chama `calculateMooveFee` no cliente para renderizar o valor da taxa na UI. Isso é apenas cosmético e não afeta a Transaction criada no servidor, mas se a regra de taxa mudar no backend, a exibição no front ficará desatualizada.

**Risco crítico:** `POST /api/events` aceita `ticketTypes` com `price` vindo do cliente e cria eventos sem verificar sessão. Qualquer pessoa com acesso à URL pode criar eventos. Este endpoint deve ser **removido ou protegido**.

### 2.3 Fluxo financeiro completo

```
Comprador preenche DynamicEventForm
        │
        ▼
POST /api/enroll
  ├── Busca TicketType.price no banco (fonte da verdade)
  ├── calculateMooveFee(price) → grossValue, mooveFee, organizerNetValue
  ├── Cria Participant (REGISTERED) + Transaction (PENDING)
  ├── Reserva estoque (soldQuantity++)
  └── Se pago: chama POST /api/checkout internamente
        │
        ▼
POST /api/checkout
  ├── Recalcula taxa do banco (idempotência)
  ├── Cria Preference no Mercado Pago (marketplace_fee = mooveFee)
  └── Retorna initPoint para redirect
        │
        ▼
Mercado Pago processa pagamento
        │
        ▼
POST /api/webhooks/mercadopago
  ├── Valida assinatura HMAC-SHA256
  ├── Consulta status real na API do MP
  ├── Reconcilia transaction_amount vs grossValue
  ├── APPROVED → Participant CONFIRMED
  └── REJECTED/CANCELLED → libera estoque (soldQuantity--)
```

---

## 3. Diagnóstico de Componentes e Interface

### 3.1 DynamicEventForm

**Arquivo:** `src/components/events/dynamic-event-form.tsx`  
**Estado:** ✅ **FUNCIONAL E COMPLETO**

- Renderiza campos fixos (nome + email) + campos dinâmicos do `formStructure`
- Suporta todos os tipos: `text`, `email`, `tel`, `number`, `select`, `checkbox`, `textarea`
- Envia `POST /api/enroll` com `eventId`, `ticketTypeId` e `formData`
- Trata loading, erros de validação (422), estoque esgotado (409) e redirect para Mercado Pago
- Serializa `price` como `number` (não `Decimal`) para cruzar a fronteira server→client

### 3.2 ParticipantTable

**Arquivo:** `src/components/admin/participant-table.tsx`  
**Estado:** ✅ **FUNCIONAL E COMPLETO**

- Tabela com paginação (10 por página), busca local por nome/email/ordem
- Badges de status de inscrição e pagamento com cores semânticas
- Ordenação por ordem de compra ou nome (A-Z)
- Coluna dinâmica: renderiza campos extras do `formData` (resposta ao `formStructure`)
- Integra `ParticipantEditDialog` para edição inline de status
- Botão de export CSV via `/api/admin/events/[id]/export`

### 3.3 FormBuilder

**Arquivo:** `src/components/admin/form-builder.tsx`  
**Estado:** ✅ **FUNCIONAL E COMPLETO**

- Editor visual que produz e consome o JSON `EventFormStructure`
- Suporta 8 tipos de campo: text, email, tel, number, url, select, checkbox, textarea
- Para campos `select`: adiciona/remove opções dinamicamente
- Reordenação por chevrons ↑↓, toggle de obrigatoriedade
- Visualização do JSON gerado em tempo real

### 3.4 Estrutura do `formStructure` no banco

**Schema Prisma:**
```prisma
model Event {
  formStructure Json @default("{\"fields\":[]}")
  // ...
}

model Participant {
  formData Json @default("{}")
  // ...
}
```

**Tipagem TypeScript (`src/types/index.ts`):**
```typescript
interface FormField {
  name: string          // snake_case, ex: "cpf_participante"
  label: string         // rótulo exibido, ex: "CPF do Participante"
  type: "text" | "email" | "tel" | "number" | "select" | "checkbox" | "textarea"
  required?: boolean
  options?: string[]    // apenas para type === "select"
  placeholder?: string
}

interface EventFormStructure {
  fields: FormField[]
}
```

**Exemplo real (seed evento OmegaConf Tech 2026):**
```json
{
  "fields": [
    { "name": "empresa",  "label": "Empresa / Organização", "type": "text",   "required": false },
    { "name": "cargo",    "label": "Cargo",                 "type": "text",   "required": false },
    { "name": "nivel",    "label": "Nível de Experiência",  "type": "select", "required": true,
      "options": ["Júnior", "Pleno", "Sênior", "Tech Lead", "Gestor"] },
    { "name": "linkedin", "label": "Perfil do LinkedIn",    "type": "url",    "required": false },
    { "name": "termos",   "label": "Aceito receber comunicações", "type": "checkbox", "required": false }
  ]
}
```

A validação dos campos obrigatórios ocorre corretamente no `POST /api/enroll` iterando `formStructure.fields`.

---

## 4. Lacunas e Pontos Quebrados

### 4.1 Next-Auth — estado atual

| Item | Estado |
|---|---|
| `next-auth` instalado | ✅ v5.0.0-beta.25 |
| `src/auth.config.ts` (Edge) | ✅ Callbacks `authorized`, `jwt`, `session` |
| `src/auth.ts` (Node.js) | ✅ `CredentialsProvider` + Prisma + bcryptjs |
| `src/app/api/auth/[...nextauth]/route.ts` | ✅ Handlers GET/POST |
| `src/middleware.ts` | ✅ Em `src/` (correção crítica de localização) |
| Cookie `admin_token` | ✅ **Removido** |
| `SessionProvider` no root layout | ✅ Adicionado |
| `/admin/login` | ✅ Sympla minimalista com `LoginForm` |
| `User.password` no schema | ✅ Migração aplicada |
| Admin seed com senha hash | ✅ `admin@eventosomega.com / Admin@2026!` |
| Proteção `/admin/*` → ADMIN only | ✅ Testado (307 sem sessão) |
| Proteção `/dashboard/*` → ORGANIZER+ADMIN | ✅ Testado (307 sem sessão) |

**Bug crítico resolvido:** o middleware estava em `middleware.ts` na raiz do projeto. Em projetos Next.js com estrutura `src/`, o Next.js ignora o arquivo na raiz e só lê `src/middleware.ts`. Após mover o arquivo, o middleware passou a interceptar corretamente todas as rotas.

**Credenciais de desenvolvimento:**

| Role | E-mail | Senha |
|---|---|---|
| ADMIN | `admin@eventosomega.com` | `Admin@2026!` |
| ORGANIZER | `organizer@eventosomega.com` | `Org@2026!` |

### 4.2 Rotas verificadas

| Rota | Estado | Observação |
|---|---|---|
| `/admin/login` | ✅ Existe e funcional | Login unificado Admin + Organizer |
| `/checkout/[id]` | ✅ Existe e funcional | Retry de pagamento com `RetryPaymentButton` |
| Busca na Home (`?q=`) | ✅ Implementada | Server Component + `SearchBar` com debounce 300ms |
| `/event/[slug]` | ✅ Completa | Layout 2 colunas Sympla |
| `/dashboard/events/new` | ✅ Completa | Formulário Sympla 7 seções |
| `/admin/events/new` | ⚠️ Incompleta | Usa `AdminEventForm` (básico), não o Sympla |

### 4.3 Lacunas identificadas

#### Crítica — `POST /api/events` sem autenticação
O endpoint `POST /api/events` aceita criação de eventos sem verificar sessão. Qualquer pessoa com acesso à URL pode criar eventos. A criação deve passar somente por `POST /api/admin/events` (protegido via middleware).

**Ação recomendada:** Remover o handler `POST` de `/api/events/route.ts` ou adicionar guard de sessão com role `ADMIN`/`ORGANIZER`.

#### Alta — `/dashboard/page.tsx` sem filtro por organizador
O painel do organizador busca **todos os eventos** com `prisma.event.findMany()` sem `where: { organizerId: session.user.id }`. Qualquer usuário com role `ORGANIZER` vê os eventos de todos.

**Ação recomendada:** Adicionar filtro por `organizerId` usando `session.user.id` do Auth.js.

#### Média — Formulário de criação admin desatualizado
`/admin/events/new` usa `AdminEventForm` (formulário de edição com campos básicos), enquanto `/dashboard/events/new` usa o novo `CreateEventForm` (7 seções Sympla). Inconsistência no fluxo admin vs organizador.

**Ação recomendada:** Unificar `/admin/events/new` para usar `CreateEventForm` ou `AdminEventForm` com as mesmas seções.

#### Baixa — Exibição de taxa no cliente
`DynamicEventForm` importa e chama `calculateMooveFee` no cliente para renderizar o valor da taxa na UI. Sem risco financeiro real (a Transaction é criada no servidor), mas arquiteturalmente a exibição deveria vir do servidor.

---

## 5. Resumo Executivo

### ✅ Pronto e funcional

- **Camada financeira completa:** `fee.ts`, `/api/enroll`, `/api/checkout`, `/api/webhooks/mercadopago` (HMAC, reconciliação de valor, idempotência, liberação de estoque)
- **Auth.js v5 completo:** login, sessão JWT com `role` + `mercadoPagoUserId`, middleware com proteção por role em `src/middleware.ts`
- **Página pública `/event/[slug]`** com layout two-column estilo Sympla
- **Home com busca server-side** debounced (`?q=` em title, description, city, venue)
- **Formulário de criação de evento** 7 seções Sympla (`/dashboard/events/new`)
- **`DynamicEventForm`, `ParticipantTable`, `FormBuilder`** — todos funcionais e completos
- **Redirect 308** `/events/[id]` → `/event/[slug]` preservado para SEO
- **Rota de retry de pagamento** `/checkout/[id]`
- **Export CSV** de participantes (`/api/admin/events/[id]/export`)
- **Dashboard financeiro** `/admin/dashboard` com KPIs e ranking de eventos

### ⚠️ Incompleto — precisa de atenção

| Prioridade | Item | Ação |
|---|---|---|
| 🔴 Crítica | `POST /api/events` sem autenticação | Remover handler POST ou adicionar guard de sessão |
| 🟠 Alta | `/dashboard/page.tsx` sem filtro por `organizerId` | Adicionar `where: { organizerId: userId }` |
| 🟡 Média | `/admin/events/new` usa formulário desatualizado | Unificar com `CreateEventForm` (Sympla) |
| 🟢 Baixa | Taxa Moove calculada no cliente para UI | Mover exibição para server component |

### ❌ Deletar imediatamente

| Arquivo | Motivo |
|---|---|
| `src/components/dashboard/event-form.tsx` | Formulário legado sem nenhum consumidor |
| `src/hooks/use-event-form.ts` | Hook sem nenhum consumidor |
| `createOrderSchema` + `CreateOrderInput` em `validations.ts` | Resquício do fluxo de "orders" removido |

---

*Documento gerado em 20/05/2026. Para atualizar, re-executar a varredura do repositório.*
