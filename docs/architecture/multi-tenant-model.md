# Modelo Multi-tenant — OPFY Board

## Princípio

Nenhum dado de um tenant é acessível, direta ou indiretamente, por outro tenant, em nenhuma camada da aplicação. Ver ADR-0001 para a decisão de shared DB + RLS.

## Camadas de isolamento

1. **Banco de dados (RLS)**: toda tabela de negócio tem policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. Sem essa variável de sessão definida, nenhuma linha é retornada (fail-closed, não fail-open).
2. **Camada de aplicação**: todo use case recebe `tenantId` explicitamente do contexto de autenticação (nunca de um parâmetro de URL/body não validado) e todo repositório filtra por ele.
3. **Guard HTTP**: valida que o `tenant_id` do token do usuário corresponde ao tenant do recurso/rota solicitada antes de chamar qualquer use case.
4. **Filas/Workers**: todo job carrega `tenant_id` no payload; o worker abre sua própria transação com `SET LOCAL app.tenant_id` antes de processar.
5. **Integração com Voice OS**: todo request ao `VoiceOSPort` inclui `tenant_id`; o adapter é responsável por garantir que o Voice OS também aplique isolamento por tenant do lado dele (dependência externa a validar — ver ADR-0004).
6. **Storage de documentos**: chave do objeto no MinIO sempre prefixada por `tenant_id` (`{tenant_id}/{document_id}/{filename}`), com policy de bucket negando listagem cross-prefix.

## O que NUNCA existe entre tenants

- Usuários (a tabela `users` é global, mas o acesso a dados de negócio só existe via `memberships` explícita a um tenant).
- Cache Redis: chaves sempre prefixadas por `tenant_id`.
- Configurações, especialistas ativos, KPIs, documentos, conversas, recomendações.

## Testes obrigatórios

Todo módulo que introduz uma tabela nova deve incluir um teste de integração que:
1. Cria dois tenants com dados equivalentes.
2. Autentica como usuário do tenant A.
3. Tenta ler/escrever um recurso do tenant B por ID direto.
4. Assert: 404 (não 403 — não revelar existência do recurso).

## Onboarding e ciclo de vida do tenant

- Criação do tenant → trial de 7 dias sem cartão (conforme folheto) → convite de membros → uso completo do plano `trial`.
- Suspensão (inadimplência/fim de trial sem upgrade): dados preservados, acesso somente leitura por um período de retenção antes de expurgo (LGPD).
- Exclusão de tenant: soft delete imediato + job de expurgo definitivo após o período de retenção contratual/legal, removendo também os dados correspondentes no Voice OS via a porta de integração.
