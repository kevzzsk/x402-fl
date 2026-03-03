# x402-fl: Local x402 Payment Facilitator

[![npm version](https://img.shields.io/npm/v/x402-fl)](https://www.npmjs.com/package/x402-fl)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A local [x402](https://www.x402.org/) facilitator for development and testing. One command gives you a fully functional x402 payment environment: a forked Base mainnet via Foundry Anvil paired with a local facilitator server. Build and test x402-powered apps without touching real funds.

> **Warning**: Local development only. Uses Anvil's deterministic private keys, which are publicly known and provide zero security. Do not use in production.

> **Note**: Currently supports USDC on Base. Custom ERC-20 token support is on the [roadmap](#roadmap).

## What it does

```
npx x402-fl dev
```

That's it. Behind the scenes, `x402-fl`:

1. **Forks Base mainnet** using Anvil with real USDC contract state, at zero cost
2. **Starts a facilitator server** that verifies and settles x402 payments locally
3. **Provides a `fund` command** to mint USDC to any address instantly

## Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io/)
- One of:
  - [Foundry](https://www.getfoundry.sh/introduction/installation) (recommended, provides `anvil`)
  - [Docker](https://docs.docker.com/get-docker/) (fallback, runs Anvil in a container)

## Quick Start

Try it instantly with npx:

```bash
npx x402-fl dev
```

Or install globally:

```bash
npm install -g x402-fl
x402-fl dev
```

This starts Anvil on port 8545 and launches the facilitator on port 4022.

### From source

```bash
git clone https://github.com/anthropics/x402-fl.git
cd x402-fl
pnpm install
pnpm dev
```

Fund an account with 100 USDC:

```bash
x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 100
```

## CLI Commands

### `x402-fl dev`

Start Anvil fork + facilitator server for local x402 development.

```bash
x402-fl dev [options]
```

| Flag                    | Default                    | Description                                                   |
| ----------------------- | -------------------------- | ------------------------------------------------------------- |
| `--port <number>`       | `4022`                     | Facilitator HTTP port                                         |
| `--anvil-port <number>` | `8545`                     | Anvil RPC port                                                |
| `--rpc-url <url>`       | `https://mainnet.base.org` | Base RPC URL to fork                                          |
| `-v`                    |                            | Show facilitator request logs                                 |
| `-vv`                   |                            | Show facilitator request logs and Anvil process logs          |
| `--private-key <key>`   |                            | Custom facilitator private key (prefer default Anvil account) |

> **Warning**: `--private-key` is not recommended

> **Note**: anvil state is not persisted.

### `x402-fl fund`

Fund any address with USDC on the local Anvil fork.

```bash
x402-fl fund <address> <amount> [options]
```

| Argument / Flag         | Default  | Description                                                      |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `<address>`             | required | 0x-prefixed Ethereum address to fund                             |
| `<amount>`              | required | USDC amount in major units (human-readable, e.g. `100` or `1.5`) |
| `--anvil-port <number>` | `8545`   | Anvil RPC port                                                   |

### `x402-fl balance`

Check USDC balance for an address on the local Anvil fork.

```bash
x402-fl balance <address> [options]
```

| Argument / Flag         | Default  | Description                  |
| ----------------------- | -------- | ---------------------------- |
| `<address>`             | required | 0x-prefixed Ethereum address |
| `--anvil-port <number>` | `8545`   | Anvil RPC port               |

## Facilitator API Endpoints

The facilitator server exposes the following HTTP endpoints (default `http://localhost:4022`):

### `POST /verify`

Verify an x402 payment payload without settling it.

**Request body:**

```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response:** Verification result from the facilitator.

### `POST /settle`

Settle (execute) a verified x402 payment on-chain.

**Request body:**

```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response:** Settlement result with transaction details.

### `GET /supported`

List supported payment schemes and networks.

**Response:**

```json
{ ... }
```

### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "network": "base-mainnet",
  "facilitator": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

## Test Accounts

The facilitator uses Anvil's default deterministic account (index 0). **Do not use these keys for anything real.**

| Role        | Address                                      |
| ----------- | -------------------------------------------- |
| Facilitator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Any address can be funded using `x402-fl fund`.

## Roadmap

- [ ] Custom ERC-20 token support
- [ ] Custom Fork url
- [ ] Custom Fork block height
- [x] Dockerised anvil node (fallback when Foundry is not installed)
- [ ] Testcontainers for facilitator + anvil for deterministic testing env

## Issues

Found a bug or have a feature request? [Open an issue](https://github.com/anthropics/x402-fl/issues).

## License

MIT
