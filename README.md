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

### `dev`

Start Anvil fork + facilitator server for local x402 development.

```bash
x402-fl dev [options]
```

| Flag                    | Default                    | Description                                          |
| ----------------------- | -------------------------- | ---------------------------------------------------- |
| `--port <number>`       | `4022`                     | Facilitator HTTP port                                |
| `--anvil-port <number>` | `8545`                     | Anvil RPC port                                       |
| `--rpc-url <url>`       | `https://mainnet.base.org` | Base RPC URL to fork                                 |
| `-v`                    |                            | Show facilitator request logs                        |
| `-vv`                   |                            | Show facilitator request logs and Anvil process logs |

### `fund`

Fund any address with USDC on the local Anvil fork.

```bash
x402-fl fund <address> <amount> [options]
```

| Argument / Flag         | Default  | Description                                       |
| ----------------------- | -------- | ------------------------------------------------- |
| `<address>`             | required | 0x-prefixed Ethereum address to fund              |
| `<amount>`              | required | USDC amount (human-readable, e.g. `100` or `1.5`) |
| `--anvil-port <number>` | `8545`   | Anvil RPC port                                    |

### `balance`

Check USDC balance for an address on the local Anvil fork.

```bash
x402-fl balance <address> [options]
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

## Roadmap

- [ ] Custom ERC-20 token support
- [ ] Custom Fork url
- [ ] Dockerised anvil node
- [ ] Testcontainers for facilitator + anvil for deterministic testing env

## Issues

Found a bug or have a feature request? [Open an issue](https://github.com/anthropics/x402-fl/issues).

## License

MIT
