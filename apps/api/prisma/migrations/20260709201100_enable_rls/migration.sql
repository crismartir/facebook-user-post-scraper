-- ADR-0001: Row-Level Security para isolamento multi-tenant.
--
-- `memberships` usa uma policy dupla: uma linha é visível se o `tenant_id`
-- da sessão bate (app.tenant_id) OU se o `user_id` da sessão bate
-- (app.user_id). O segundo caso resolve o problema de bootstrap do login:
-- ao autenticar, ainda não sabemos a qual tenant o usuário quer se conectar,
-- então precisamos poder listar as memberships do próprio usuário antes de
-- fixar um tenant_id de sessão. Isso nunca expõe memberships de OUTRO
-- usuário — apenas as do próprio ator autenticado.
--
-- `sessions` e `refresh_tokens` NÃO recebem RLS nesta fase: são localizadas
-- por um segredo opaco de alta entropia (hash do refresh token) antes de o
-- tenant ser conhecido — o mesmo problema de bootstrap, sem uma coluna de
-- "dono" única como em memberships. O isolamento delas é garantido por
-- unicidade/imprevisibilidade do token + verificação explícita de
-- tenant/sessão no código da aplicação (ver auth.service.ts). Tabelas de
-- domínio (kpis, documents, conversations etc., a partir da Fase 1) seguem
-- a policy simples de `tenant_id`, sem essa exceção.

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_or_self_isolation" ON "memberships"
  USING (
    "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "audit_log"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
