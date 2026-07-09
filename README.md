# OPFY Board

SaaS multi-tenant AI-first: Conselho Executivo Inteligente para empresas, integrado ao ecossistema Voice OS.

> Nota: este repositório nasceu como `facebook-user-post-scraper`. O desenvolvimento do OPFY Board acontece nesta branch/repositório por decisão explícita do usuário, já que a criação de um repositório novo foi bloqueada por permissão da integração de GitHub desta sessão (ver `docs/rfcs/RFC-0001-opfy-board-architecture.md`, seção 0). O código original do scraper (`facebook_user_post_scraper.zip`) permanece intocado.

## Documentação de arquitetura

Antes de qualquer implementação, leia nesta ordem:

1. [`docs/rfcs/RFC-0001-opfy-board-architecture.md`](docs/rfcs/RFC-0001-opfy-board-architecture.md) — visão geral da arquitetura
2. `docs/adrs/` — decisões arquiteturais (ADR-0001 a ADR-0007)
3. `docs/architecture/` — modelo de dados, autenticação/autorização, multi-tenant, segurança, escalabilidade, backup, observabilidade, deploy, estimativa de infraestrutura e custo
4. [`docs/roadmap.md`](docs/roadmap.md) — fases de implementação

## Estado atual

**Fase 0 do roadmap implementada**: monorepo (`apps/api` NestJS + `apps/web` Next.js), módulos `identity` (registro, login, MFA-ready, refresh rotativo) e `tenancy`, isolamento multi-tenant com PostgreSQL RLS (ADR-0001), Docker Compose (dev e produção), health checks, CI (lint/typecheck/build/test). Validado ponta a ponta em navegador real e com teste automatizado de isolamento cross-tenant. Ver `docs/roadmap.md` para as próximas fases — a Fase 2 (integração real com o Voice OS) depende de acesso ao repositório/contrato real do Voice OS, hoje fora do escopo desta sessão.

## Desenvolvimento local

Pré-requisitos: Node 20+, pnpm 10+, Docker (ou um PostgreSQL 16 local).

```bash
pnpm install

# Banco de desenvolvimento
docker compose -f docker-compose.dev.yml up -d

# API
cp apps/api/.env.example apps/api/.env
pnpm --filter @opfy-board/api exec prisma migrate deploy
pnpm dev:api      # http://localhost:3001

# Web (em outro terminal)
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web      # http://localhost:3000
```

Testes:

```bash
pnpm --filter @opfy-board/api test        # unitários
pnpm --filter @opfy-board/api test:e2e    # isolamento cross-tenant, auth (requer Postgres)
```

Deploy em produção (VPS único, ADR-0006): `docker compose up -d --build`, com um `.env` preenchido a partir de `.env.example` na raiz.