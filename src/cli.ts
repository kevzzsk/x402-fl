#!/usr/bin/env node

import { readFileSync } from "fs";
import { Command, InvalidArgumentError } from "commander";
import { defaults } from "./lib/config.js";
import { devCommand } from "./commands/dev.js";
import { fundCommand } from "./commands/fund.js";
import { balanceCommand } from "./commands/balance.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError("must be a number between 1 and 65535");
  }
  return port;
}

function parseAddress(value: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new InvalidArgumentError(
      "must be a valid 0x-prefixed Ethereum address (42 characters)",
    );
  }
  return value as `0x${string}`;
}

function parseAmount(value: string): string {
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
    throw new InvalidArgumentError(
      "must be a positive number (e.g. '100' or '1.5')",
    );
  }
  return value;
}

const program = new Command();

program
  .name("x402-fl")
  .description(
    "Local x402 facilitator dev tool\n\n" +
      "  Spin up a local Anvil fork and x402 facilitator server for development.\n" +
      "  Requires `anvil` (from Foundry) to be installed and available in PATH.\n\n" +
      "  Quick start:\n" +
      "    $ x402-fl dev\n" +
      "    $ x402-fl fund 0xYourAddress 100",
  )
  .version(pkg.version)
  .showHelpAfterError(true)
  .configureHelp({ showGlobalOptions: true });

program
  .command("dev")
  .description(
    "Start Anvil fork + facilitator server for local x402 development",
  )
  .option(
    "--port <number>",
    `facilitator server port`,
    parsePort,
    defaults.facilitatorPort,
  )
  .option(
    "--anvil-port <number>",
    `Anvil JSON-RPC port`,
    parsePort,
    defaults.anvilPort,
  )
  .option("--rpc-url <url>", `Base mainnet RPC URL to fork (default: ${defaults.rpcUrl})`)
  .option("-v, --verbose", "verbose output (-v facilitator logs, -vv anvil logs)", (_: string, prev: number) => prev + 1, 0)
  .addHelpText(
    "after",
    `
Examples:
  $ x402-fl dev
  $ x402-fl dev --rpc-url https://custom-rpc.example.com --port 5000`,
  )
  .action(async (opts, command) => {
    const rpcUrl = opts.rpcUrl || defaults.rpcUrl;

    await devCommand({
      port: opts.port,
      anvilPort: opts.anvilPort,
      rpcUrl,
      portExplicit: command.getOptionValueSource("port") !== "default",
      anvilPortExplicit:
        command.getOptionValueSource("anvilPort") !== "default",
      verbose: opts.verbose,
    });
  });

program
  .command("fund")
  .description("Fund an address with USDC on local Anvil")
  .argument("<address>", "0x-prefixed Ethereum address to fund", parseAddress)
  .argument("<amount>", "USDC amount (e.g. '100' or '1.5')", parseAmount)
  .option(
    "--anvil-port <number>",
    `Anvil JSON-RPC port`,
    parsePort,
    defaults.anvilPort,
  )
  .addHelpText(
    "after",
    `
Examples:
  $ x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 100
  $ x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1.5 --anvil-port 9545`,
  )
  .action(async (address: `0x${string}`, amount: string, opts) => {
    await fundCommand({
      address,
      amount,
      anvilPort: opts.anvilPort,
    });
  });

program
  .command("balance")
  .description("Get USDC balance for an address on local Anvil")
  .argument("<address>", "0x-prefixed Ethereum address to check", parseAddress)
  .option(
    "--anvil-port <number>",
    `Anvil JSON-RPC port`,
    parsePort,
    defaults.anvilPort,
  )
  .addHelpText(
    "after",
    `
Examples:
  $ x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  $ x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --anvil-port 9545`,
  )
  .action(async (address: `0x${string}`, opts) => {
    await balanceCommand({
      address,
      anvilPort: opts.anvilPort,
    });
  });

program.parse();
