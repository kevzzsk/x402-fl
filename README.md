# x402-fl

Local x402 facilitator for development and testing. Forks Base mainnet with Foundry Anvil and runs a local facilitator server. Fund any address with USDC via direct storage manipulation.

> **Warning**: This is for local development only. Do NOT use in production. It uses Anvil's well-known deterministic private keys, which are publicly known and have zero security.

## What it does

`x402-fl` spins up a complete local x402 payment environment in one command:

1. Forks Base mainnet using Anvil (so you get real USDC contract state)
2. Starts a local facilitator server that can verify and settle x402 payments
3. Provides a `fund` command to mint USDC to any address via Anvil storage manipulation

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)
- [Foundry](https://www.getfoundry.sh/introduction/installation) (provides `anvil`)
- A Base mainnet RPC URL (e.g. `https://mainnet.base.org`, Alchemy, or Infura)

## Quick Start

```bash
git clone https://github.com/anthropics/x402-fl.git
cd x402-fl
pnpm install
```

Create a `.env` file:

```bash
cp .env.example .env
# Edit .env and set BASE_RPC_URL
```

Start the local environment:

```bash
pnpm dev
```

This starts Anvil on port 8545 and launches the facilitator on port 4022.

Fund an account with USDC:

```bash
npx tsx src/cli.ts fund 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 100
```

## CLI Commands

### `dev`

Start Anvil fork + facilitator server for local x402 development.

```bash
pnpm dev [options]
```

| Flag                    | Default                | Description           |
| ----------------------- | ---------------------- | --------------------- |
| `--port <number>`       | `4022`                 | Facilitator HTTP port |
| `--anvil-port <number>` | `8545`                 | Anvil RPC port        |
| `--rpc-url <url>`       | `BASE_RPC_URL` env var | Base RPC URL to fork  |

### `fund`

Fund any address with USDC on the local Anvil fork.

```bash
npx tsx src/cli.ts fund <address> <amount> [options]
```

| Argument / Flag         | Default  | Description                                       |
| ----------------------- | -------- | ------------------------------------------------- |
| `<address>`             | required | 0x-prefixed Ethereum address to fund              |
| `<amount>`              | required | USDC amount (human-readable, e.g. `100` or `1.5`) |
| `--anvil-port <number>` | `8545`   | Anvil RPC port                                    |

### `balance`

Check USDC balance for an address on the local Anvil fork.

```bash
npx tsx src/cli.ts balance <address> [options]
```

| Argument / Flag         | Default  | Description                  |
| ----------------------- | -------- | ---------------------------- |
| `<address>`             | required | 0x-prefixed Ethereum address |
| `--anvil-port <number>` | `8545`   | Anvil RPC port               |

## Test Accounts

The facilitator uses Anvil's default deterministic account (index 0). **Do not use these keys for anything real.**

| Role        | Address                                      |
| ----------- | -------------------------------------------- |
| Facilitator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Any address can be funded using `x402-fl fund`.

## How it works

Anvil forks Base mainnet at the latest block, giving you a local copy of all on-chain state including the USDC contract. The `fund` command uses `anvil_setStorageAt` to directly write ERC-20 balance values into contract storage — it auto-detects the correct storage slot by probing common mapping layouts (slots 0–20). The facilitator server exposes `/verify`, `/settle`, `/supported`, and `/health` endpoints using the `@x402/core` and `@x402/evm` packages, operating against the local Anvil fork instead of real Base mainnet.

## Roadmap

- [ ] Custom ERC-20 token support
- [ ] Custom Fork url
- [ ] Dockerised anvil node
- [ ] Testcontainers for facilitator + anvil for deterministic testing env

## Issues

Found a bug or have a feature request? [Open an issue](https://github.com/anthropics/x402-fl/issues).

## License

MIT
