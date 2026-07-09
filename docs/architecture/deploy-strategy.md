# Estratégia de Deploy — OPFY Board

Ver ADR-0006 para a decisão de VPS único + Docker Compose.

## Ambientes

| Ambiente | Onde roda | Propósito |
|---|---|---|
| Development | Máquina local do time, `docker compose -f docker-compose.dev.yml` | Desenvolvimento diário, hot reload |
| Homologação | Mesmo VPS, subdomínio `staging.opfyboard.com` (a confirmar domínio real), containers isolados por prefixo/rede Docker | Validação antes de produção, dados sintéticos |
| Produção | VPS Hostinger, domínio principal | Clientes reais |

## Pipeline CI/CD (GitHub Actions)

1. **PR aberto**: lint, type-check, testes unitários e de integração (incluindo os testes obrigatórios de isolamento cross-tenant — `multi-tenant-model.md`), build das imagens Docker (sem push).
2. **Merge em `main`**: build das imagens `api`, `web`, `worker` → push para registry privado (GitHub Container Registry) com tag = SHA do commit → deploy automático em **Homologação**.
3. **Promoção para Produção**: manual (workflow_dispatch ou tag `release/*`), reaproveitando a mesma imagem já validada em homologação — nunca rebuilda para produção a partir de código diferente do que foi testado.

## Deploy no VPS

```
1. SSH no VPS (chave de deploy dedicada, não a chave pessoal de nenhum humano)
2. docker compose pull            # baixa as novas imagens
3. docker compose run --rm api npx prisma migrate deploy   # migração antes do restart
4. docker compose up -d --wait    # sobe com healthcheck, aguarda ready
5. Verifica /health/ready de api e web
6. Se falhar: docker compose up -d <imagem-anterior> (rollback por tag)
```

## Zero downtime (dentro das limitações de um VPS único)

- Múltiplas réplicas do container `api` no Compose (`deploy.replicas` ou serviços numerados) atrás do Caddy, com `up -d --wait` trocando uma réplica de cada vez (rolling restart manual até introduzir uma ferramenta de orquestração mais sofisticada).
- Migrações sempre **backward-compatible** dentro do mesmo deploy (aditivas primeiro; remoção de coluna/tabela só num deploy subsequente, após o código que a usava já não estar em produção) — evita quebra durante o intervalo entre migração e restart de todas as réplicas.
- Caddy só roteia para réplicas que passaram no healthcheck.

## Rollback

- Toda imagem é taggeada com o SHA do commit — rollback é `docker compose up -d` apontando para a tag anterior, sem rebuild.
- Migrações destrutivas exigem um plano de rollback documentado no próprio PR (ADR de dados) antes de serem aceitas.

## Migrações automáticas

- Rodam como um passo do deploy (`prisma migrate deploy`), nunca manualmente em produção.
- Toda migração é revisada em PR como qualquer outra mudança de código.
