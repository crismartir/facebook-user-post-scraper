# ADR-0003 — Stack tecnológica (backend, frontend, dados)

- **Status**: Aceito
- **Contexto**: RFC-0001, seções 2-4

## Decisão

| Camada | Escolha | Motivo |
|---|---|---|
| Backend | Node.js + TypeScript + NestJS | DI nativa e módulos mapeiam 1:1 para bounded contexts; suporte de primeira classe a Clean Architecture (controllers/use cases/domain); mesma linguagem do frontend reduz custo de contratação/manutenção de uma equipe pequena |
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui | SSR para o dashboard (performance percebida), componentes acessíveis prontos para customizar na identidade visual do folheto, dark/light mode nativo via CSS variables |
| Banco de dados | PostgreSQL 16 | RLS nativo (ADR-0001), JSONB para dados semi-estruturados (ex.: payload de recomendações), extensível (pgvector se necessário no futuro para busca local, sem duplicar o GraphRAG do Voice OS) |
| Cache/Filas | Redis + BullMQ | Único componente cobre cache de leitura e fila de jobs; maduro, baixo custo operacional |
| Storage de arquivos | MinIO (S3-compatible) no próprio VPS | Documentos/relatórios sem depender de serviço pago externo; migração futura para S3 real é transparente (mesma API) |
| Proxy/TLS | Caddy | TLS automático (Let's Encrypt) sem configuração manual, HTTP/2, simples de operar em um VPS único |
| ORM | Prisma | Migrações versionadas, tipagem ponta a ponta, suporte a `SET LOCAL` via `$executeRaw` para RLS |

## Alternativas consideradas e rejeitadas

- **Django/Python**: rejeitado — não há justificativa técnica para introduzir uma segunda linguagem/runtime quando TypeScript cobre backend e frontend com um único conjunto de ferramentas e tipos compartilhados (contratos de API).
- **MongoDB**: rejeitado — o domínio é fortemente relacional (tenants, usuários, memberships, permissões, auditoria); JSONB do Postgres cobre os casos semi-estruturados sem abrir mão de integridade referencial e RLS.
- **Firebase/Supabase gerenciado**: rejeitado como dependência principal — vai contra "priorizar infraestrutura já existente e menor custo recorrente"; Postgres self-hosted no VPS já contratado tem custo marginal zero.

## Consequências

- Positivo: stack única em TypeScript reduz custo de manutenção e contratação.
- Positivo: todos os componentes rodam em containers Docker no mesmo VPS — nenhum serviço pago novo introduzido.
- Negativo: sem gerenciamento automático de banco (backup/HA) de um provedor gerenciado — mitigado pela estratégia de backup própria (`docs/architecture/backup-strategy.md`) e pela possibilidade de migrar para Postgres gerenciado no futuro sem mudar a aplicação (mesma interface SQL).
