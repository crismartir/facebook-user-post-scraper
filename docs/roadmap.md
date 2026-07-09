# Roadmap de Implementação — OPFY Board

Fases pequenas, incrementais, reversíveis e testáveis. Cada fase termina em um estado deployável (mesmo que incompleto em funcionalidades), nunca em código pela metade.

## Fase 0 — Fundação
- Monorepo (api, web, workers, docs), lint/format, CI básico.
- Módulo `tenancy` + `identity`: criação de tenant, cadastro, login, RBAC básico (owner/admin/member), guard de multi-tenant + RLS (ADR-0001).
- Docker Compose (dev e produção), deploy manual inicial no VPS, health checks.
- **Critério de saída**: criar conta, criar tenant, logar, ver uma tela vazia autenticada, isolamento cross-tenant coberto por teste automatizado.

## Fase 1 — Dashboard Executivo (estático) + Gestão de tenant
- Layout do dashboard ("Visão Geral") replicando a linguagem visual do folheto: Saúde da Empresa, Recomendações, Próximas Ações, Desempenho por Área — com dados mockados/manuais (sem IA ainda).
- Convite de membros, gestão de papéis, configurações do tenant.
- MFA (TOTP) e trial de 7 dias sem cartão.
- **Critério de saída**: um Owner convida um Admin, ambos veem o dashboard com dados de exemplo, MFA funcional.

## Fase 2 — Primeira integração real com Voice OS
- **Bloqueante**: validar o contrato real do `VoiceOSPort` com acesso ao repositório/API do Voice OS (ADR-0004) antes de iniciar.
- Implementar o adapter real para **um único especialista** (CEO Estratégico) como prova de conceito ponta a ponta: chat, histórico de conversa, exibição no dashboard.
- **Critério de saída**: usuário conversa com o CEO Estratégico, histórico persistido, métricas de uso capturadas (observability).

## Fase 3 — Conselho completo
- Demais 6 especialistas (CFO, Comercial, Marketing, Operações, Pessoas, CTO) via o mesmo adapter.
- Recomendações Inteligentes e Próximas Ações alimentadas pelas respostas dos especialistas (não mais mockadas).
- **Critério de saída**: os 7 cards do folheto funcionam de ponta a ponta com dados reais de IA.

## Fase 4 — Módulos de domínio
- Financeiro, Marketing, Comercial, Operações, Pessoas, Tecnologia: telas dedicadas por área, KPIs reais com série histórica (`kpi_snapshots`).
- **Critério de saída**: cada área tem uma tela própria com pelo menos 3 KPIs reais e gráfico de evolução.

## Fase 5 — Diagnóstico, Documentos, Relatórios, Análises Estratégicas
- Upload de documentos com ingestão no Voice OS (Knowledge Base/GraphRAG existente, via `ingestDocument`).
- Geração de relatórios (job assíncrono, fila).
- **Critério de saída**: upload de um documento, especialista referencia esse documento numa resposta.

## Fase 6 — Hardening
- WebAuthn/Passkeys, auditoria completa revisada, backups automatizados com teste de restore trimestral rodando de verdade, observabilidade completa (dashboards + alertas), rate limiting/WAF, ferramentas LGPD (exportação e exclusão de dados do tenant, incluindo expurgo no Voice OS).
- **Critério de saída**: exercício de restore de backup bem-sucedido documentado; pentest/security review interno sem achado crítico aberto.

## Fase 7 — Billing e escala horizontal
- Planos pagos (upgrade de trial para Pro), gateway de pagamento.
- Réplicas horizontais de `api`/`worker`, PgBouncer, reavaliação do dimensionamento de infraestrutura (`infra-and-cost-estimate.md`).
- **Critério de saída**: um tenant faz upgrade de trial para Pro e é cobrado corretamente; carga de teste confirma que 2 réplicas de `api` atendem sem sticky session.

## Regra de todas as fases
Nenhuma fase começa sem que a anterior esteja deployada e testada em Homologação. Nenhuma fase introduz uma segunda arquitetura paralela de IA, memória ou multi-tenancy — todas reaproveitam o que foi decidido nas ADRs 0001-0007.
