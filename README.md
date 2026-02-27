# x402-fl

Local x402 facilitator for development and testing. Forks Base mainnet with Foundry Anvil, funds test accounts with real USDC, and runs a local facilitator server.

> **Warning**: This is for local development only. Do NOT use in production. It uses Anvil's well-known deterministic private keys, which are publicly known and have zero security.

## What it does

`x402-fl` spins up a complete local x402 payment environment in one command:

1. Forks Base mainnet using Anvil (so you get real USDC contract state)
2. Impersonates a USDC whale to fund a test payer account
3. Starts a local facilitator server that can verify and settle x402 payments

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (provides `anvil`)
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

This starts Anvil on port 8545, funds the payer account with 100 USDC, and launches the facilitator on port 4022.

## CLI Commands

### `dev`

Start Anvil fork + fund accounts + facilitator server.

```bash
pnpm dev [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port <number>` | `4022` | Facilitator HTTP port |
| `--anvil-port <number>` | `8545` | Anvil RPC port |
| `--rpc-url <url>` | `BASE_RPC_URL` env var | Base RPC URL to fork |
| `--fund-amount <usdc>` | `100` | USDC to fund payer account |

### `test`

Run an end-to-end test against a running facilitator. Signs a payment, verifies it, settles it, and checks balances.

```bash
pnpm test:e2e [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--facilitator-url <url>` | `http://127.0.0.1:4022` | Facilitator URL |
| `--amount <usdc>` | `1.00` | Payment amount to test |

### `info`

Print account addresses, ports, and config.

```bash
npx tsx src/cli.ts info
```

## Test Accounts

These are Anvil's default deterministic accounts. **Do not use these keys for anything real.**

| Role | Address |
|------|---------|
| Facilitator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Payer | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Recipient | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |

## How it works

Anvil forks Base mainnet at the latest block, giving you a local copy of all on-chain state including the USDC contract. The tool then uses Anvil's `impersonateAccount` to transfer USDC from a known whale address (Circle's reserve) to the test payer account. The facilitator server exposes `/verify`, `/settle`, `/supported`, and `/health` endpoints using the `@x402/core` and `@x402/evm` packages, operating against the local Anvil fork instead of real Base mainnet.

## License

MIT
