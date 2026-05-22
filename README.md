# EventosOmega

Plataforma de venda de ingressos e gestão de eventos (Next.js 16, Prisma, PostgreSQL, Mercado Pago).

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Setup local

```bash
cp .env.example .env.local
# Preencha DATABASE_URL, AUTH_SECRET, MERCADOPAGO_* e NEXT_PUBLIC_APP_URL

npm install
npm run db:migrate
npm run db:seed   # obrigatório em dev — popula eventos, patrocinadores e banners da home
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Usuários de desenvolvimento (seed)

| Papel | E-mail | Senha |
|-------|--------|-------|
| Admin | `admin@eventosomega.com` | `Admin@2026!` |
| Organizador | `organizer@eventosomega.com` | `Org@2026!` |

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários |
| `npm run test:smoke` | Valida banco + APIs/home (dev server opcional) |
| `npm run db:migrate` | Aplica migrations |
| `npm run db:seed` | Popula dados de exemplo |

## Deploy

1. Configure as variáveis de ambiente (ver `.env.example`)
2. Execute `npx prisma migrate deploy`
3. **Não** execute o seed em produção
4. Configure o webhook do Mercado Pago para `https://SEU_DOMINIO/api/webhooks/mercadopago`
5. Use `AUTH_SECRET` forte e credenciais MP de produção
6. Crie uma aplicação **Marketplace** no painel MP e configure a Redirect URL: `{NEXT_PUBLIC_APP_URL}/api/mercadopago/callback`
7. Organizadores conectam a conta MP em `/dashboard` antes de vender ingressos pagos
8. Configure **Resend** (`RESEND_API_KEY`, `EMAIL_FROM`) para envio automático de ingressos por e-mail

## Estrutura principal

- `/` — vitrine pública de eventos
- `/event/[slug]` — página do evento + inscrição
- `/meus-ingressos` — consulta de pedidos por e-mail
- `/dashboard` — painel do organizador
- `/admin` — painel administrativo

## Segurança

Rotas `/api/admin/*` exigem autenticação. Organizadores só acessam seus próprios eventos. Patrocinadores globais da home são restritos a administradores.
