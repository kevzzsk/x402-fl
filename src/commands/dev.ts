import chalk from "chalk";
import boxen from "boxen";
import { Option, type Command } from "commander";
import type { Server } from "http";
import { startAnvil, waitForAnvil, isFoundryInstalled, type AnvilInstance } from "../lib/anvil.js";
import { startFacilitator } from "../lib/facilitator.js";
import { fetchChainId } from "../lib/chain.js";
import { defaults, networkId, getUsdcAddress, getNetwork, NETWORKS, DEFAULT_NETWORK } from "../lib/config.js";
import { parsePort, parsePrivateKey } from "../lib/parsers.js";
import { resolvePort } from "../lib/port.js";
import { setVerbosity } from "../lib/log.js";

export function register(program: Command) {
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
    .addOption(
      new Option("--network <name>", "network preset")
        .choices(Object.keys(NETWORKS))
        .default(DEFAULT_NETWORK),
    )
    .option("--rpc-url <url>", `RPC URL to fork (overrides the --network preset's default)`)
    .option("--anvil-host <host>", "Anvil listen host (default: 127.0.0.1)")
    .option("--private-key <key>", "facilitator private key (default: Anvil account 0)", parsePrivateKey)
    .option("-v, --verbose", "verbose output (-v facilitator logs, -vv anvil logs)", (_: string, prev: number) => prev + 1, 0)
    .addHelpText(
      "after",
      `
Examples:
  $ x402-fl dev
  $ x402-fl dev --network base-sepolia
  $ x402-fl dev --rpc-url https://custom-rpc.example.com --port 5000`,
    )
    .action(async (opts, command) => {
      const rpcUrl = opts.rpcUrl || getNetwork(opts.network).rpcUrl;

      try {
        await devCommand({
          port: opts.port,
          anvilPort: opts.anvilPort,
          anvilHost: opts.anvilHost,
          rpcUrl,
          privateKey: opts.privateKey,
          portExplicit: command.getOptionValueSource("port") !== "default",
          anvilPortExplicit:
            command.getOptionValueSource("anvilPort") !== "default",
          verbose: opts.verbose,
        });
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

export interface DevOptions {
  port: number;
  anvilPort: number;
  anvilHost?: string;
  rpcUrl: string;
  privateKey?: `0x${string}`;
  portExplicit: boolean;
  anvilPortExplicit: boolean;
  verbose: number;
}

export async function devCommand(options: DevOptions): Promise<void> {
  setVerbosity(options.verbose);

  const anvilPort = await resolvePort(options.anvilPort, options.anvilPortExplicit, "Anvil");
  const facilitatorPort = await resolvePort(options.port, options.portExplicit, "Facilitator");

  const localRpcUrl = `http://localhost:${anvilPort}`;
  let anvilProc: AnvilInstance | null = null;
  let server: Server | null = null;

  function cleanup() {
    console.log("\nShutting down...");
    let pending = 0;
    const done = () => { if (--pending <= 0) process.exit(0); };

    if (server) {
      pending++;
      server.close(() => done());
      server = null;
    }
    if (anvilProc) {
      pending++;
      anvilProc.stop().then(done, done);
      anvilProc = null;
    }
    if (pending === 0) process.exit(0);

    // Force exit after 3s if graceful shutdown hangs
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 0. Detect chain ID from fork RPC and validate USDC support
  console.log(chalk.dim(`Detecting chain ID from ${options.rpcUrl}...`));
  const chainId = await fetchChainId(options.rpcUrl);
  console.log(chalk.dim(`Detected chain ID: ${chainId}`));

  // Validate early — before starting any background processes
  getUsdcAddress(chainId);

  // 1. Start Anvil
  console.log(
    chalk.dim(
      `Starting Anvil (forking chain ${chainId}, port ${anvilPort})...`,
    ),
  );
  anvilProc = startAnvil({
    forkUrl: options.rpcUrl,
    port: anvilPort,
    chainId,
    host: options.anvilHost,
  });

  anvilProc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(chalk.red(`Anvil exited with code ${code}`));
      process.exit(1);
    }
  });

  // 2. Wait for Anvil to be ready
  console.log(chalk.dim("Waiting for Anvil to be ready..."));
  const anvilTimeout = isFoundryInstalled() ? 30_000 : 120_000;
  await waitForAnvil(localRpcUrl, anvilTimeout);
  console.log(chalk.dim("Anvil is ready."));

  // 3. Start facilitator
  console.log(chalk.dim(`Starting facilitator on port ${facilitatorPort}...`));
  const facilitator = await startFacilitator({
    port: facilitatorPort,
    rpcUrl: localRpcUrl,
    chainId,
    privateKey: options.privateKey,
  });
  server = facilitator.server;

  const network = networkId(chainId);

  // 4. Print summary
  console.log(
    boxen(
      [
        `${chalk.dim("Anvil RPC")}     ${chalk.cyan(localRpcUrl)}`,
        `${chalk.dim("Facilitator")}   ${chalk.cyan(`http://localhost:${facilitatorPort}`)}`,
        `${chalk.dim("Network")}       ${network}`,
        `${chalk.dim("Chain ID")}      ${chainId}`,
        "",
        chalk.dim("Accounts"),
        `  ${chalk.dim("Facilitator")}  ${facilitator.address}`,
        "",
        `${chalk.dim("USDC")}          ${getUsdcAddress(chainId)}`,
        "",
        `${chalk.dim("Fund account with:")}`,
        `$ ${chalk.white("x402-fl fund <address> <amount>")}`,
        "",
        chalk.dim("Press Ctrl+C to stop."),
      ].join("\n"),
      {
        title: "x402-fl dev",
        padding: 1,
        borderStyle: "round",
        borderColor: "green",
      },
    ),
  );
}
