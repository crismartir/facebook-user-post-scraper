# RFC-0001 — Arquitetura do OPFY Board

- **Status**: Proposto
- **Autor**: Claude (Principal Software Architect), a pedido de suporteopfy@gmail.com
- **Data**: 2026-07-09
- **Escopo**: Desenho completo da plataforma OPFY Board (SaaS multi-tenant, AI-first, integrado ao Voice OS)

## 0. Premissas e limitações declaradas

Esta RFC foi produzida a partir de três fontes:

1. O prompt mestre do produto (funcionalidades, identidade visual, princípios).
2. O folheto visual do OPFY Board (brochura anexada) — usado como referência de UX/produto, não copiado literalmente.
3. Um material genérico de fundamentos de arquitetura de software (Codefinity, "Fundamentos de Arquitetura de Software") — usado como base teórica (Clean Architecture, separação de responsabilidades, modularidade, padrões de projeto).

**Não foi possível localizar, nesta sessão, um repositório de código já existente contendo o runtime do Voice OS, os especialistas de IA, o GraphRAG, a Knowledge Base ou o Conversation Runtime.** O acesso do GitHub desta sessão está restrito ao repositório `crismartir/facebook-user-post-scraper` (onde este documento está sendo escrito, por decisão explícita do usuário, já que a criação de um repositório novo foi bloqueada por permissão da integração). Repositórios como `OPFY-AI`, `opfy-ai-codex`, `opfy-flow-compass` existem na conta do usuário mas não foram liberados para leitura nesta sessão.

**Consequência arquitetural:** esta RFC trata o Voice OS como um **sistema externo já existente**, integrado exclusivamente por meio de uma **porta de integração (Ports & Adapters)** bem definida (seção 6). Nenhuma lógica de IA, memória ou RAG é reimplementada aqui — apenas o contrato de integração é especificado. Antes da Fase 2 do roadmap (seção 17), é **bloqueante** revisar esta RFC com acesso real ao repositório do Voice OS para confirmar/ajustar o contrato proposto. Isso não é uma limitação de escopo — é a aplicação literal da regra do prompt: "nunca crie uma segunda arquitetura paralela."

## 1. Objetivo

Construir o OPFY Board: um SaaS multi-tenant onde cada empresa cliente tem acesso a um "Conselho Executivo Inteligente" — sete especialistas de IA (CEO, CFO, Comercial, Marketing, Operações, Pessoas, Tecnologia) que operam sobre os dados daquela empresa, compartilhando contexto e memória entre si, com um dashboard executivo (Saúde da Empresa, KPIs, Recomendações, Planos de Ação) como ponto central de uso diário.

## 2. Visão de arquitetura em alto nível

```
                         ┌─────────────────────────────┐
                         │        Edge / Proxy          │
                         │   Caddy (TLS, rate limit)     │
                         └───────────┬──────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                                        │
        ┌────────▼─────────┐                    ┌─────────▼─────────┐
        │   Web (Next.js)    │                    │   API (NestJS)     │
        │   Dashboard SSR/CSR │◄──── REST/GraphQL ─┤   Clean Architecture│
        └─────────────────────┘                    └────────┬───────────┘
                                                              │
                     ┌────────────────────────────────────────┼─────────────────────────┐
                     │                                         │                          │
            ┌────────▼────────┐                     ┌──────────▼─────────┐    ┌───────────▼───────────┐
            │ PostgreSQL (RLS) │                     │  Redis (cache/fila) │    │ Voice OS Adapter (porta)│
            │ multi-tenant     │                     │  BullMQ workers     │    │  → Voice OS (externo)   │
            └──────────────────┘                     └──────────┬──────────┘    └────────────────────────┘
                                                                 │
                                                        ┌────────▼────────┐
                                                        │  Workers (jobs)  │
                                                        │  relatórios, IA  │
                                                        └──────────────────┘
```

Tudo roda em um único Hostinger VPS via Docker Compose (seção 15), com caminho de crescimento horizontal sem reescrita (seção 12).

## 3. Princípios arquiteturais adotados

Aplicando os fundamentos do material de referência ao contexto deste produto:

- **Clean Architecture / Ports & Adapters** por serviço: `domain` (entidades, regras de negócio) → `application` (casos de uso) → `infrastructure` (Postgres, Redis, Voice OS, storage) → `interface` (HTTP controllers). Dependências sempre apontam para dentro; infraestrutura nunca vaza para o domínio.
- **Separação de responsabilidades (SoC)**: cada bounded context (Tenancy, Identity, Board/Specialists, KPIs, Documents, Billing) é um módulo NestJS isolado, com sua própria camada de aplicação e domínio.
- **Baixo acoplamento / alta coesão**: comunicação entre módulos internos via interfaces de aplicação (use cases), nunca acesso direto a repositórios de outro módulo.
- **Modularidade preparada para extração**: cada módulo é escrito como se pudesse, no futuro, virar um serviço separado (mesmo rodando hoje num monólito modular) — sem acoplar a um único processo.
- **Trade-off explícito (regra do material de referência: "nenhuma arquitetura é perfeita")**: optamos por um **monólito modular** em vez de microsserviços na Fase 0–5. Justificativa na ADR-0002.

## 4. Módulos do domínio (Bounded Contexts)

| Módulo | Responsabilidade | Não faz |
|---|---|---|
| `identity` | Usuários, autenticação, MFA, sessões, RBAC | Não guarda dados de negócio do tenant |
| `tenancy` | Empresas (tenants), planos, convites, configurações | Não implementa auth |
| `board` | Orquestração dos 7 especialistas, conversas, recomendações | Não implementa IA — delega ao Voice OS Adapter |
| `kpi` | Indicadores, Saúde da Empresa, séries históricas | Não calcula IA — consome eventos e Voice OS |
| `documents` | Upload, versionamento, storage de documentos/relatórios | Não indexa RAG — delega ao Voice OS (Knowledge Base) |
| `audit` | Log imutável de eventos de auditoria (todos os módulos publicam) | Somente-escrita por outros módulos; leitura via API própria |
| `billing` | Planos, trial, limites de uso por tenant | Não processa pagamento diretamente (usa gateway externo) |
| `voice-os-adapter` | Porta única de integração com o Voice OS | Não implementa lógica de IA |

## 5. Modelo de dados (resumo — detalhado em `docs/architecture/data-model.md`)

Banco único PostgreSQL, schema compartilhado, isolamento por `tenant_id` + Row-Level Security. Tabelas core: `tenants`, `users`, `memberships` (user↔tenant com role), `sessions`, `refresh_tokens`, `specialists` (catálogo dos 7 papéis), `conversations`, `messages`, `recommendations`, `action_plans`, `kpis`, `kpi_snapshots`, `documents`, `audit_log`. Todas com `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete) e `audit_log` append-only.

## 6. Integração com Voice OS (porta de integração)

Interface estável (`VoiceOSPort`), implementada por um adapter HTTP/gRPC contra o Voice OS real:

```ts
interface VoiceOSPort {
  askSpecialist(input: {
    tenantId: string;
    specialistRole: SpecialistRole; // CEO | CFO | CMO | CCO | COO | CHRO | CTO
    conversationId: string;
    message: string;
  }): Promise<SpecialistReply>;

  getSharedMemory(tenantId: string, scope: MemoryScope): Promise<MemorySnapshot>;
  queryKnowledge(tenantId: string, query: string): Promise<GraphRAGResult>;
  ingestDocument(tenantId: string, documentRef: DocumentRef): Promise<void>;
}
```

O OPFY Board **nunca** persiste memória de IA, embeddings ou grafo de conhecimento — isso pertence ao Voice OS. O OPFY Board persiste apenas metadados de produto (quem perguntou o quê, quando, em qual conversa) para exibir no dashboard e para auditoria. Ver ADR-0004.

## 7. Autenticação e autorização

Ver `docs/architecture/auth-and-authz.md` para o fluxo completo. Resumo: e-mail+senha (Argon2id) → MFA obrigatório para Owners/Admins (TOTP, com Passkeys/WebAuthn como via preferencial) → JWT de acesso curto (10–15 min) em cookie `httpOnly`/`secure`/`SameSite=strict` → refresh token rotativo, hash armazenado, detecção de reuse (revoga a cadeia inteira em caso de replay). RBAC granular por módulo × ação × tenant.

## 8. Modelo multi-tenant

Ver `docs/architecture/multi-tenant-model.md`. Shared DB/shared schema + `tenant_id` obrigatório em toda tabela de negócio + PostgreSQL RLS habilitado, com o `tenant_id` fixado por requisição via `SET LOCAL app.tenant_id`. Guard de aplicação valida o tenant do usuário autenticado contra o tenant da URL/recurso antes de qualquer query (defesa em profundidade — nunca confiar só na RLS).

## 9. Segurança

Ver `docs/architecture/security-model.md`. Cobre MFA, WebAuthn, CSRF, XSS/CSP, SQLi (ORM parametrizado + RLS), SSRF (allowlist de egress para o Voice OS Adapter), rate limiting, proteção contra brute-force/credential stuffing/session hijacking/replay, Argon2id, TLS 1.2+/1.3, AES-256 em repouso para campos sensíveis, segredos via variáveis de ambiente/vault, logs imutáveis, LGPD/Privacy by Design.

## 10. Escalabilidade

Ver `docs/architecture/scalability-strategy.md`. Stateless API (sessão só em JWT+DB), múltiplas réplicas do container `api` atrás do Caddy quando necessário, PgBouncer para pooling, filas (BullMQ/Redis) para tudo que não é síncrono (chamadas ao Voice OS, geração de relatórios, ingestão de documentos), cache de leitura para KPIs/dashboard.

## 11. Backup e disaster recovery

Ver `docs/architecture/backup-strategy.md`. `pg_dump`/WAL archiving diário + retenção 30 dias, backup de volumes de documentos, teste de restore trimestral, RPO alvo 24h (Fase 0-3) evoluindo para 1h (com WAL streaming) na Fase 6.

## 12. Observabilidade

Ver `docs/architecture/observability-strategy.md`. Logs estruturados (JSON, pino/nestjs-pino) com `tenant_id` e `trace_id` em toda linha, tracing OpenTelemetry, métricas Prometheus, dashboards Grafana, alertas via Alertmanager → e-mail/Slack, métricas de custo/uso de IA por tenant capturadas no `voice-os-adapter`.

## 13. Deploy

Ver `docs/architecture/deploy-strategy.md`. Docker Compose no VPS Hostinger, CI/CD via GitHub Actions (build → test → push imagem → deploy via SSH), migrações automáticas antes do restart, estratégia de rollback por tag de imagem anterior, ambientes Development (local), Homologação (VPS, subdomínio `staging.`) e Produção (VPS, domínio principal).

## 14. Estimativas de infraestrutura e custo

Ver `docs/architecture/infra-and-cost-estimate.md`.

## 15. Roadmap

Ver `docs/roadmap.md` — fases pequenas, incrementais, reversíveis e testáveis.

## 16. Decisões arquiteturais relevantes (ADRs)

- ADR-0001 — Multi-tenancy: shared DB/schema + RLS
- ADR-0002 — Monólito modular (não microsserviços) nas fases iniciais
- ADR-0003 — Stack backend/frontend (NestJS + Next.js + PostgreSQL + Redis)
- ADR-0004 — Integração com Voice OS via Ports & Adapters
- ADR-0005 — Autenticação: JWT curto + refresh rotativo + WebAuthn
- ADR-0006 — Deploy em VPS único via Docker Compose
- ADR-0007 — Observabilidade self-hosted (Grafana/Loki/Prometheus)

## 17. Riscos abertos

1. **Contrato do Voice OS não confirmado** — bloqueante antes da Fase 2 (ver seção 0).
2. **Identidade visual**: reproduzida por interpretação do folheto, não há Design System/Figma da OPFY disponível nesta sessão — recomenda-se validar com o time de design antes da Fase 1.
3. **Definição de "Pro" e limites de plano** (billing) — o folheto menciona plano "Pro" e trial de 7 dias sem cartão; regras de billing detalhadas não foram especificadas e precisam de decisão de produto.
