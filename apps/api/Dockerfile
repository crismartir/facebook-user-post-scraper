# Build de produção do backend (ADR-0006, deploy-strategy.md). Instala o
# workspace inteiro (mais simples e mais previsível que prunar node_modules
# manualmente numa imagem final) — otimização de tamanho de imagem fica
# para uma fase posterior, não é crítica para o Phase 0.
FROM node:20-bookworm-slim

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
RUN pnpm --filter @opfy-board/api exec prisma generate
RUN pnpm --filter @opfy-board/api build

WORKDIR /workspace/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
