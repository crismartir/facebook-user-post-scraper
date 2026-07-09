# Estratégia de Observabilidade — OPFY Board

Ver ADR-0007 para a decisão de stack self-hosted.

## Logs
- Estruturados em JSON (`nestjs-pino`), nunca `console.log` solto.
- Todo log de requisição carrega: `trace_id`, `tenant_id`, `user_id` (quando autenticado), `route`, `status`, `duration_ms`.
- Nenhum log contém senha, token, ou payload bruto de MFA — campos sensíveis são redigidos (`***`) antes de logar.
- Agregados no Loki, consultáveis por tenant/rota/erro no Grafana.

## Métricas
- Prometheus coleta métricas de aplicação (via `prom-client`): latência por rota (histograma), taxa de erro, tamanho de fila BullMQ, conexões ativas de banco.
- Métricas de negócio por tenant: número de chamadas ao Voice OS, tokens/custo estimado de IA consumidos, KPIs atualizados, documentos ingeridos — expostas em um dashboard "Uso por Tenant" (insumo direto para billing e para detectar abuso).

## Tracing
- OpenTelemetry SDK instrumentando HTTP, Prisma e chamadas ao `voice-os-adapter`.
- Um trace por requisição, correlacionado com os logs via `trace_id` — essencial para depurar latência em chamadas que atravessam API → fila → worker → Voice OS.

## Dashboards (Grafana)
- **Operacional**: latência p50/p95/p99 por rota, taxa de erro, saúde dos containers, profundidade de fila.
- **Custo/Uso de IA**: chamadas ao Voice OS por tenant/dia, latência média do Voice OS, taxa de erro/timeout da integração.
- **Segurança**: tentativas de login falhas, MFA falhas, reuse de refresh token detectado, acessos negados por RLS/guard.

## Alertas (Alertmanager)
- Erro 5xx acima de limiar por 5 min.
- Fila BullMQ crescendo sem processar por N minutos.
- Uso de disco/CPU/memória do VPS acima de limiar.
- Falha de backup diário (job não completou).
- Latência do Voice OS acima de limiar (sinal de degradação da dependência externa).

Canal de notificação inicial: e-mail (Fase 0-3); Slack/webhook quando o time operar em canal dedicado (Fase 4+).

## Health checks
- `/health/live` (processo respondendo) e `/health/ready` (dependências — Postgres, Redis, Voice OS Adapter — respondendo) em todo serviço, usados pelo Docker Compose/Caddy para decidir roteamento e pelo pipeline de deploy para confirmar sucesso antes do cutover.
