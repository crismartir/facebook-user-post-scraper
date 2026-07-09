# ADR-0007 — Observabilidade self-hosted (Prometheus + Loki + Grafana)

- **Status**: Aceito
- **Contexto**: RFC-0001, seção 12; detalhado em `docs/architecture/observability-strategy.md`

## Decisão

Rodar uma stack de observabilidade self-hosted no mesmo VPS: **Prometheus** (métricas), **Loki** (logs, via `nestjs-pino` em JSON estruturado), **Grafana** (dashboards e alertas), **Alertmanager** (notificações). Tracing distribuído via **OpenTelemetry SDK**, exportado para um coletor local (Grafana Tempo ou Jaeger, a definir na Fase 6 conforme volume real).

## Alternativas consideradas

- **SaaS de observabilidade pago (Datadog, New Relic)**: rejeitado como padrão inicial — custo recorrente por host/evento não se justifica no estágio atual; reavaliar apenas se o volume de dados tornar o self-hosted operacionalmente caro em recursos do VPS.
- **Sem observabilidade estruturada (apenas `console.log`)**: rejeitado — viola exigência explícita de auditoria completa, métricas de custo/uso de IA por tenant e SLA de detecção de incidentes.

## Consequências

- Positivo: custo adicional zero (mesmo VPS), controle total dos dados (relevante para LGPD — nenhum log de tenant sai para um terceiro).
- Positivo: toda linha de log carrega `tenant_id` e `trace_id`, permitindo auditoria e depuração por cliente.
- Negativo: consome recursos do VPS (CPU/RAM/disco) — dimensionado e monitorado desde a Fase 0 para evitar que a stack de observabilidade compita com a aplicação; watchdog de retenção de logs/métricas (ex.: 30 dias) evita crescimento ilimitado de disco.
