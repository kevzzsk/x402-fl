FROM node:24-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Foundry v1.5.1 – separate stage for proper platform resolution
FROM ghcr.io/foundry-rs/foundry@sha256:3a70bfa9bd2c732a767bb60d12c8770b40e8f9b6cca28efc4b12b1be81c7f28e AS foundry

FROM node:24-slim
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY dist/ ./dist/
USER node
EXPOSE 8545 4022
ENTRYPOINT ["node", "dist/cli.js", "dev", "--anvil-port", "8545", "--anvil-host", "0.0.0.0", "--port", "4022"]
CMD ["--network", "base"]
