# Estratégia de Escalabilidade — OPFY Board

## Princípio

Escalar para milhares de empresas sem reescrever a arquitetura — apenas adicionando capacidade horizontal aos mesmos componentes (ADR-0002, ADR-0006).

## Stateless por design
- Nenhum estado de sessão em memória de processo; tudo em JWT (curto) + Postgres (refresh tokens, sessões) + Redis (cache).
- Qualquer réplica do container `api` pode atender qualquer requisição — permite escalar horizontalmente atrás do Caddy sem sticky sessions.

## Banco de dados
- PgBouncer (connection pooling) entre a API e o Postgres, evitando exaustão de conexões ao escalar réplicas.
- Índices compostos `(tenant_id, ...)` em toda tabela de alto volume (definidos junto com a migração que cria a tabela, não depois).
- Particionamento por `tenant_id` (ou por faixa de tempo, para `kpi_snapshots`/`audit_log`) avaliado quando o volume justificar — não implementado prematuramente.

## Cache
- Redis para leitura de dashboard (Saúde da Empresa, KPIs agregados) com invalidação por evento (quando um KPI é atualizado, a chave correspondente é invalidada, não por TTL cego).
- Cache sempre segmentado por `tenant_id` (modelo multi-tenant).

## Filas e background jobs
- Toda chamada ao Voice OS que não precisa de resposta síncrona (ingestão de documento, geração de relatório, cálculo de recomendação) vai para uma fila BullMQ, processada por workers dedicados (containers separados da API), escaláveis independentemente.
- Isola picos de uso de IA do caminho crítico do dashboard — um tenant fazendo muitas perguntas ao especialista não deve degradar o tempo de resposta do dashboard de outro tenant.

## Compressão e transporte
- Compressão HTTP (gzip/brotli) no Caddy.
- Paginação obrigatória em toda listagem (nunca retornar coleção não limitada).
- Lazy loading no frontend (Next.js dynamic imports) para módulos pesados (ex.: editor de relatórios).

## Caminho de crescimento (sem re-arquitetar)

| Sinal | Ação |
|---|---|
| CPU da API constantemente alta | Subir réplicas do container `api` no mesmo VPS ou em um segundo VPS atrás do Caddy |
| Postgres é o gargalo | Aumentar recursos do VPS de banco, avaliar réplica de leitura para dashboards/relatórios |
| Fila cresce mais rápido que processa | Subir réplicas do worker |
| Um tenant exige isolamento físico | Migrar apenas aquele tenant para banco dedicado (o modelo de dados já suporta, ADR-0001) |
| Necessidade real de deploy independente por módulo | Extrair o módulo do monólito modular para serviço próprio (fronteiras já existem, ADR-0002) |

Nenhum desses passos exige reescrever regras de negócio — todos são mudanças de infraestrutura/deploy.
