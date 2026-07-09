# Modelo de Dados — OPFY Board

Todas as tabelas de negócio têm: `id UUID PK`, `tenant_id UUID NOT NULL` (exceto `tenants` em si e tabelas globais como `specialists`), `created_at`, `updated_at`, `deleted_at NULL` (soft delete), e são cobertas por RLS (ADR-0001).

## Tabelas core

### `tenants`
Empresa cliente. `id, name, slug, plan (trial|pro), trial_ends_at, status (active|suspended|canceled), created_at`.

### `users`
Identidade global (uma pessoa pode pertencer a mais de um tenant). `id, email UNIQUE, password_hash, mfa_enabled, mfa_secret_encrypted, created_at`.

### `memberships`
Vínculo usuário↔tenant com papel. `id, tenant_id, user_id, role (owner|admin|manager|member|viewer), invited_by, accepted_at`.

### `sessions`
Sessão lógica para revogação/auditoria. `id, user_id, tenant_id, device_fingerprint, ip, user_agent, created_at, revoked_at`.

### `refresh_tokens`
`id, session_id, token_hash, rotated_from, expires_at, used_at, revoked_at`.

### `specialists` (catálogo global, não é por tenant)
`id, role (ceo|cfo|cmo|cco|coo|chro|cto), display_name, description, icon`.

### `conversations`
`id, tenant_id, specialist_id, opened_by (user_id), title, created_at, last_message_at`.

### `messages`
`id, tenant_id, conversation_id, author_type (user|specialist), author_id, content, voice_os_ref (id externo da resposta no Voice OS, se aplicável), created_at`.

### `recommendations`
`id, tenant_id, specialist_id, title, description, impact_estimate, status (open|in_progress|done|dismissed), created_at`.

### `action_plans`
`id, tenant_id, title, description, owner_user_id, due_date, status, created_at`.

### `kpis`
Definição do indicador. `id, tenant_id, area (financeiro|comercial|marketing|operacoes|pessoas|tecnologia), name, unit, target_value`.

### `kpi_snapshots`
Série histórica. `id, tenant_id, kpi_id, value, captured_at` — indexado por `(tenant_id, kpi_id, captured_at)`.

### `documents`
`id, tenant_id, uploaded_by, filename, storage_key (MinIO), mime_type, size_bytes, ingested_to_voice_os (bool), created_at`.

### `audit_log`
Append-only, sem `updated_at`/soft delete. `id, tenant_id, actor_user_id, action, resource_type, resource_id, metadata JSONB, ip, created_at`. Nenhum módulo tem permissão de `UPDATE`/`DELETE` nesta tabela — apenas `INSERT` e `SELECT`.

## Diagrama textual de relacionamentos

```
tenants 1──N memberships N──1 users
tenants 1──N conversations N──1 specialists
conversations 1──N messages
tenants 1──N recommendations N──1 specialists
tenants 1──N kpis 1──N kpi_snapshots
tenants 1──N documents
tenants 1──N audit_log
users 1──N sessions 1──N refresh_tokens
```

## Convenções

- Toda FK entre tabelas de negócio inclui `tenant_id` na constraint composta quando aplicável, evitando referência cross-tenant por construção.
- Migrações via Prisma, versionadas, revisadas em PR; nenhuma migração destrutiva sem plano de rollback documentado no próprio PR.
- Soft delete (`deleted_at`) em tudo que é editável pelo usuário; hard delete apenas via job de expurgo de LGPD (direito ao esquecimento), auditado.
