FROM node:24-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

FROM node:24-slim
COPY --from=ghcr.io/foundry-rs/foundry:v1.5.0 /usr/local/bin/anvil /usr/local/bin/anvil
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY dist/ ./dist/
USER node
EXPOSE 8545 4022
ENTRYPOINT ["node", "dist/cli.js", "dev", "--anvil-port", "8545", "--anvil-host", "0.0.0.0", "--port", "4022"]
CMD ["--rpc-url", "https://mainnet.base.org"]
