# Build de produção do frontend (ADR-0006, deploy-strategy.md).
FROM node:20-bookworm-slim

RUN corepack enable
WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

# Variáveis NEXT_PUBLIC_* são inlinadas no bundle do cliente em build time,
# não em runtime — por isso precisam existir como ARG/ENV antes do build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @opfy-board/web build

WORKDIR /workspace/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
