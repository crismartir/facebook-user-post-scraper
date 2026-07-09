# Estratégia de Backup e Disaster Recovery — OPFY Board

## O que é protegido
- Banco PostgreSQL (todos os dados de negócio, incluindo `audit_log`).
- Volumes MinIO (documentos enviados pelos tenants).
- Configuração de infraestrutura (arquivos Docker Compose, variáveis de ambiente — versionados fora do repositório de código-fonte, em cofre de segredos).

## Rotina (Fases 0-3)
- `pg_dump` completo diário, retido por 30 dias, armazenado **fora do VPS de produção** (bucket externo de baixo custo ou o próprio storage do Hostinger, se distinto do VPS de aplicação).
- Backup dos volumes MinIO diário (rsync incremental), mesma retenção.
- Backups cifrados em repouso (AES-256) e em trânsito.

## Evolução (Fase 6)
- WAL archiving contínuo (PITR — point-in-time recovery), reduzindo RPO de 24h para ~1h.
- Automação de teste de restore (ver abaixo) integrada ao pipeline de CI, não apenas manual.

## Teste de restore
- **Trimestral, obrigatório**: restaurar o backup mais recente em um ambiente isolado (não produção) e validar integridade (contagem de linhas por tabela, checksum de amostra de documentos, login de teste funcional).
- Resultado documentado (data, sucesso/falha, tempo de restore) — vira insumo do RTO real, não estimado.

## Metas (targets)
| Métrica | Fase 0-3 | Fase 6+ |
|---|---|---|
| RPO (perda máxima de dados) | 24h | ~1h |
| RTO (tempo para restaurar) | < 4h | < 1h |

## Disaster recovery — VPS único
Dado que a decisão (ADR-0006) é operar em um VPS único por custo, o plano de DR para perda total do VPS é:
1. Provisionar novo VPS (Hostinger, mesma região ou próxima).
2. Restaurar backup mais recente do Postgres e dos volumes MinIO.
3. Subir a stack via Docker Compose (imagens já publicadas no registry, não dependem do VPS antigo).
4. Repontar DNS.
5. Runbook documentado e testado no mesmo exercício trimestral de restore acima.

Réplica quente em segundo VPS é um item de roadmap (Fase 7), condicionado a exigência real de SLA de clientes enterprise — não implementado preventivamente (custo vs. benefício).
