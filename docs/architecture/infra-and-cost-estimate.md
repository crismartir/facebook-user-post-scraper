# Estimativa de Infraestrutura e Custos — OPFY Board

**Aviso**: valores aproximados de mercado (07/2026), para orientar a decisão — não são cotação formal do Hostinger. Confirmar plano exato disponível na conta já contratada antes de comprometer a arquitetura a um tamanho de VPS específico.

## Dimensionamento por fase

| Fase | Carga esperada | VPS sugerido | Componentes no mesmo VPS |
|---|---|---|---|
| 0-2 (fundação + MVP) | Dezenas de tenants, uso interno/beta | 4 vCPU / 8 GB RAM / 100+ GB SSD | api, web, worker, postgres, redis, minio, caddy |
| 3-5 (módulos completos) | Centenas de tenants | 8 vCPU / 16 GB RAM | + stack de observabilidade (Prometheus/Loki/Grafana) |
| 6-7 (hardening + escala) | Milhares de tenants | 16 vCPU / 32 GB RAM, ou 2º VPS separando banco da aplicação | Postgres em VPS dedicado + PgBouncer; api/worker escaláveis horizontalmente |

## Custo recorrente (estimativa, além do VPS já contratado)

| Item | Custo | Observação |
|---|---|---|
| VPS Hostinger (aplicação) | Já contratado | Reaproveitado — sem custo incremental nas Fases 0-3 |
| VPS adicional (Fase 6-7, se necessário) | ~US$ 40-80/mês | Só quando o dimensionamento acima justificar |
| Domínio + TLS | Já existente / TLS via Caddy é gratuito (Let's Encrypt) | Sem custo incremental |
| Registry de imagens (GitHub Container Registry) | Gratuito no plano atual do GitHub, dentro dos limites | Sem custo incremental |
| Backup externo (armazenamento fora do VPS) | ~US$ 5-15/mês | Ex.: object storage de baixo custo para os dumps diários |
| Gateway de pagamento (billing, Fase 7) | Taxa por transação (ex.: 2-4%) | Modelo padrão de mercado, não é custo fixo |
| E-mail transacional (convites, alertas) | Gratuito até certo volume (ex.: 100-3000 e-mails/mês em provedores com free tier) | Reavaliar se o volume crescer |

**Custo incremental total estimado nas Fases 0-3: ~US$ 5-15/mês** (essencialmente só backup externo), porque tudo mais reaproveita infraestrutura já paga.

## Estimativa de capacidade

- PostgreSQL bem indexado em um VPS de 8 GB RAM suporta, com folga, milhares de tenants de porte PME (a carga é de leitura de dashboard + escrita esporádica de eventos, não de streaming de alto volume) — o gargalo real tende a ser o volume de chamadas ao Voice OS, não o banco do OPFY Board em si.
- Redis/BullMQ: overhead baixo, dimensionado por profundidade de fila, não por número de tenants.

## Quando revisar esta estimativa

- Ao final de cada fase do roadmap, comparar uso real de CPU/RAM/disco (via os dashboards de `observability-strategy.md`) contra o dimensionamento proposto e ajustar.
- Não sobre-provisionar preventivamente — escalar reativamente com base em métrica real é mais barato e alinhado ao princípio de menor custo.
