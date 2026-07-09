# ADR-0006 — Deploy em VPS único via Docker Compose

- **Status**: Aceito
- **Contexto**: RFC-0001, seção 13; detalhado em `docs/architecture/deploy-strategy.md`

## Decisão

Executar toda a plataforma (web, api, workers, postgres, redis, minio, caddy, stack de observabilidade) em containers Docker orquestrados por **Docker Compose** em um único Hostinger VPS, com deploy automatizado via GitHub Actions (build de imagens → push para um registry privado → SSH no VPS → `docker compose pull && docker compose up -d` com migração automática antes do restart).

## Alternativas consideradas

- **Kubernetes**: rejeitado nesta fase — custo de operação (mesmo K3s) e complexidade não se justificam para a carga esperada nas Fases 0-5; caminho de migração para K8s permanece aberto (as imagens Docker são as mesmas) se a escala exigir múltiplos nós no futuro.
- **PaaS gerenciado (Render, Railway, Fly.io)**: rejeitado como padrão — custo recorrente por serviço gerenciado contraria "menor custo possível / reutilizar tudo que já existe" (o VPS Hostinger já está contratado).

## Consequências

- Positivo: custo de infraestrutura previsível e mínimo (um VPS já pago).
- Positivo: Compose é simples o suficiente para não exigir um DevOps dedicado full-time.
- Negativo: VPS único é um ponto único de falha física — mitigado por: backups automatizados fora do VPS (ADR-0001/backup-strategy), possibilidade de subir um segundo VPS como réplica a quente na Fase 7 caso o SLA do contrato exija, e monitoramento com alerta para reação rápida a incidentes.
- Negativo: "zero downtime" real exige cuidado manual no Compose (ordem de start, healthchecks, migração antes do cutover) — coberto na estratégia de deploy.
