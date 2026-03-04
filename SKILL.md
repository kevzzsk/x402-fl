# x402-fl: Agent Guide

A local x402 payment facilitator for testing. Use this when building or testing applications that integrate with the [x402 payment protocol](https://www.x402.org/). It forks Base mainnet via Anvil and runs a local facilitator server -- no real funds, no external dependencies.

## Prerequisites

Before using x402-fl, verify these are available:

```bash
# Node.js 24+
node --version

# pnpm
pnpm --version

# Foundry's Anvil (recommended)
anvil --version

# OR Docker (fallback when Foundry is not installed; also required for Testcontainers)
docker --version
```

If `anvil` is not found, install Foundry: https://www.getfoundry.sh/introduction/installation

## Recipes

### Start the environment

```bash
npx x402-fl dev
```

This starts two services:
- **Anvil** on port `8545` -- a forked Base mainnet with real USDC contract state
- **Facilitator** on port `4022` -- verifies and settles x402 payments locally

Verify it's running:

```bash
curl http://localhost:4022/health
```

Expected response:

```json
{
  "status": "ok",
  "network": "base-mainnet",
  "facilitator": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

Custom ports:

```bash
npx x402-fl dev --port 5000 --anvil-port 9545
```

### Fund an account

Mint USDC to any address. Amount is in human-readable units (e.g. `100` = 100 USDC).

```bash
npx x402-fl fund <address> <amount>
```

Example:

```bash
npx x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 100
```

### Check balance

```bash
npx x402-fl balance <address>
```

Example:

```bash
npx x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### Verify a payment

Verify an x402 payment payload without settling it.

```bash
curl -X POST http://localhost:4022/verify \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }'
```

The `paymentPayload` and `paymentRequirements` objects follow the x402 protocol spec. See [@x402/core types](https://www.npmjs.com/package/@x402/core) for the full schema.

### Settle a payment

Execute a verified payment on-chain (on the local Anvil fork).

```bash
curl -X POST http://localhost:4022/settle \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }'
```

Returns settlement result with transaction details.

### List supported schemes

```bash
curl http://localhost:4022/supported
```

Returns the payment schemes and networks the facilitator supports.

### Run via Docker

A pre-built Docker image is available:

```bash
docker run -p 4022:4022 -p 8545:8545 ghcr.io/kevzzsk/x402-fl:latest
```

Override the fork RPC URL:

```bash
docker run -p 4022:4022 -p 8545:8545 ghcr.io/kevzzsk/x402-fl:latest --rpc-url https://your-rpc-url.com
```

| Tag      | Description                                            |
| -------- | ------------------------------------------------------ |
| `latest` | Latest stable release                                  |
| `next`   | Pre-release builds (e.g. `1.0.0-beta.1`)              |
| `x.y.z`  | Pinned version (e.g. `ghcr.io/kevzzsk/x402-fl:0.1.0`) |

### Testcontainers (integration tests)

Spin up a fully isolated x402 environment in integration tests. Requires Docker and the `testcontainers` peer dependency:

```bash
pnpm install -D testcontainers
```

Usage:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";

describe("x402 integration", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    container = await new X402FacilitatorLocalContainer().start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("facilitator is healthy", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    expect(res.status).toBe(200);
  });

  it("funds an address with USDC", async () => {
    await container.fund(accounts.facilitator.address, "100");
  });

  it("checks balance", async () => {
    const result = await container.balance(accounts.facilitator.address);
    console.log(result.formatted); // e.g. "100"
  });
});
```

#### `X402FacilitatorLocalContainer`

| Method                                      | Description                                                    |
| ------------------------------------------- | -------------------------------------------------------------- |
| `new X402FacilitatorLocalContainer(image?)` | Create a container (default: `ghcr.io/kevzzsk/x402-fl:latest`) |
| `.withForkUrl(url)`                         | Set a custom Base RPC URL to fork (chainable)                  |
| `.start()`                                  | Start the container                                            |

#### `StartedX402FacilitatorLocalContainer`

| Method                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `.getRpcUrl()`           | Anvil RPC endpoint (`http://host:port`)                  |
| `.getFacilitatorUrl()`   | Facilitator HTTP endpoint (`http://host:port`)           |
| `.fund(address, amount)` | Mint USDC to an address (amount in human-readable units) |
| `.balance(address)`      | Get USDC balance (returns `{ value, formatted, decimals }`) |
| `.getPublicClient()`     | Get a viem `PublicClient` connected to the Anvil fork    |
| `.stop()`                | Stop and remove the container                            |

#### Exports from `x402-fl/testcontainers`

| Export                | Description                          |
| --------------------- | ------------------------------------ |
| `accounts`            | Pre-configured Anvil test accounts   |
| `USDC_ADDRESS`        | Base mainnet USDC contract address   |
| `fundAddress`         | Direct fund function (without container) |
| `createPublicClient`  | Create a viem public client          |
| `fetchChainId`        | Fetch chain ID from an RPC URL       |

## Reference

| Item | Value |
| --- | --- |
| Facilitator port | `4022` |
| Anvil RPC port | `8545` |
| Anvil RPC URL | `http://localhost:8545` |
| Facilitator URL | `http://localhost:4022` |
| USDC contract | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Chain ID | `8453` (Base mainnet fork) |
| Network ID | `eip155:8453` |

### Test accounts

The facilitator uses Anvil's deterministic accounts derived from the mnemonic `test test test test test test test test test test test junk`.

| Index | Role | Address |
| --- | --- | --- |
| 0 | Facilitator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Any Anvil account (indices 0-9) can be used for testing. Fund any address using `x402-fl fund`.

### CLI flags

| Flag | Default | Description |
| --- | --- | --- |
| `--port <number>` | `4022` | Facilitator HTTP port |
| `--anvil-port <number>` | `8545` | Anvil RPC port |
| `--rpc-url <url>` | `https://mainnet.base.org` | Base RPC URL to fork |
| `--private-key <key>` | Anvil account 0 | Custom facilitator private key (not recommended) |
| `-v` | | Show facilitator request logs |
| `-vv` | | Show facilitator + Anvil logs |

## Troubleshooting

**`anvil: command not found`**
Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
Or use Docker as a fallback -- x402-fl will automatically use a containerized Anvil if Foundry is not installed.

**`Error: Could not connect to Anvil at http://localhost:8545`**
The Anvil instance is not running. Start the environment first with `npx x402-fl dev`.

**Port already in use**
Use custom ports: `npx x402-fl dev --port 5000 --anvil-port 9545`

**`ECONNREFUSED` on facilitator endpoints**
The facilitator server hasn't started yet. Wait a few seconds after `x402-fl dev` or check the health endpoint.

**Anvil state is not persisted**
Each `x402-fl dev` session starts fresh. Fund accounts again after restarting.
