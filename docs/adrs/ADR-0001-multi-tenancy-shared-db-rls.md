# ADR-0001 — Multi-tenancy: banco compartilhado com Row-Level Security

- **Status**: Aceito
- **Contexto**: RFC-0001, seção 8

## Contexto

O OPFY Board precisa isolar dados de milhares de empresas (tenants), sem nunca vazar dados entre elas, mantendo baixo custo operacional em um único VPS Hostinger.

## Alternativas consideradas

1. **Database-per-tenant**: um banco Postgres por empresa. Isolamento forte, mas inviável operacionalmente para milhares de tenants em um único VPS (limites de conexões, backups individuais, migrações N vezes).
2. **Schema-per-tenant**: um schema Postgres por empresa no mesmo banco. Melhor que o anterior, mas migrações e pool de conexões ainda escalam linearmente com o número de tenants; complexidade operacional alta a partir de centenas de tenants.
3. **Shared DB / shared schema + `tenant_id` + Row-Level Security (RLS)**: uma única base, uma única aplicação de schema/migração, isolamento reforçado por policies RLS do PostgreSQL e validado novamente na camada de aplicação.

## Decisão

Adotar **shared DB/schema com `tenant_id` obrigatório em toda tabela de negócio + RLS habilitado**.

- Toda tabela de negócio tem coluna `tenant_id NOT NULL REFERENCES tenants(id)`.
- Cada tabela tem uma policy RLS: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- A cada requisição autenticada, a camada de infraestrutura executa `SET LOCAL app.tenant_id = :tenantId` dentro da transação, antes de qualquer query.
- **Defesa em profundidade**: a camada de aplicação (use cases) também filtra explicitamente por `tenant_id` — nunca depende só da RLS. Um guard NestJS rejeita qualquer requisição cujo `tenant_id` do token não bata com o recurso solicitado.
- Índices compostos `(tenant_id, ...)` em todas as tabelas de alto volume.

## Addendum (Fase 0 — implementação)

Durante a implementação da Fase 0 surgiu um problema de bootstrap: `refresh_tokens` são localizados por um segredo opaco (hash do token) e, no login, o `tenant_id` do usuário ainda não é conhecido no momento da consulta — nos dois casos, não há um `tenant_id` de sessão para configurar antes da query, então uma policy RLS estrita bloquearia até o próprio dono legítimo.

Refinamento adotado, implementado em `prisma/migrations/*_enable_rls`:

- **`memberships`** recebe uma policy dupla: uma linha é visível se `tenant_id` bate com `app.tenant_id` **OU** se `user_id` bate com `app.user_id` (uma segunda variável de sessão, fixada via `TenantPrismaService.runAsUser`). Isso resolve o bootstrap do login (listar as próprias memberships antes de escolher um tenant) sem nunca expor a membership de outro usuário.
- **`sessions` e `refresh_tokens` não recebem RLS** nesta fase. Mantêm a coluna `tenant_id` (para índices e verificação explícita no código), mas o isolamento é garantido pela imprevisibilidade do segredo (hash de 48 bytes aleatórios, consultado sempre por igualdade exata) mais checagem explícita de posse (`session.userId`, `session.revokedAt`) em `AuthService`, não por RLS. Tabelas de domínio a partir da Fase 1 (kpis, documents, conversations etc.) seguem a policy simples de `tenant_id`, sem essa exceção — ela é específica do problema de bootstrap de autenticação.

Isso não enfraquece o modelo: é a mesma classe de garantia usada por qualquer sistema de sessão baseado em token opaco (o acesso já pressupõe posse do segredo).

## Consequências

- Positivo: uma única migração, um único pool de conexões, custo mínimo, escala a milhares de tenants em um único Postgres bem dimensionado (com PgBouncer).
- Positivo: RLS oferece uma segunda barreira mesmo se um desenvolvedor esquecer o filtro de `tenant_id` numa query.
- Negativo: uma falha de configuração de RLS é um risco de vazamento entre tenants — mitigado com testes automatizados que tentam acesso cross-tenant em todo módulo (critério de aceite obrigatório em toda PR que toca uma tabela nova).
- Caminho de saída: se um tenant grande precisar de isolamento físico (contrato enterprise, exigência de compliance), o mesmo modelo de dados permite migrar esse tenant específico para um banco dedicado sem mudar a camada de aplicação.
