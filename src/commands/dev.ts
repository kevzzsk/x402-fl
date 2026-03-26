import chalk from "chalk";
import boxen from "boxen";
import { Option, type Command } from "commander";
import type { Server } from "http";
import { startAnvil, waitForAnvil, isFoundryInstalled, type AnvilInstance } from "../lib/anvil.js";
import { startFacilitator } from "../lib/facilitator.js";
import { defaults, getUsdcAddress, getNetwork, NETWORKS, DEFAULT_NETWORK, type NetworkPreset } from "../lib/config.js";
import type { NetworkConfig } from "../lib/facilitator.js";
import { parsePort, parsePrivateKey } from "../lib/parsers.js";
import { resolvePorts, resolvePort } from "../lib/port.js";
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
      `Anvil JSON-RPC port (first instance)`,
      parsePort,
      defaults.anvilPort,
    )
    .addOption(
      new Option("--network <name...>", "network preset(s) to fork (repeatable)")
        .choices(Object.keys(NETWORKS))
        .default([DEFAULT_NETWORK]),
    )
    .option("--rpc-url <url>", `RPC URL to fork (overrides the first --network preset's default)`)
    .option("--anvil-host <host>", "Anvil listen host (default: 127.0.0.1)")
    .option("--private-key <key>", "facilitator private key (default: Anvil account 0)", parsePrivateKey)
    .option("-v, --verbose", "verbose output (-v facilitator logs, -vv anvil logs)", (_: string, prev: number) => prev + 1, 0)
    .addHelpText(
      "after",
      `
Examples:
  $ x402-fl dev
  $ x402-fl dev --network base-sepolia
  $ x402-fl dev --network base --network base-sepolia
  $ x402-fl dev --rpc-url https://custom-rpc.example.com --port 5000`,
    )
    .action(async (opts, command) => {
      try {
        await devCommand({
          port: opts.port,
          anvilPort: opts.anvilPort,
          anvilHost: opts.anvilHost,
          networks: opts.network,
          rpcUrl: opts.rpcUrl,
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
  networks: string[];
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  portExplicit: boolean;
  anvilPortExplicit: boolean;
  verbose: number;
}

interface AnvilEntry {
  preset: NetworkPreset;
  port: number;
  localRpcUrl: string;
  proc: AnvilInstance;
}

export async function devCommand(options: DevOptions): Promise<void> {
  setVerbosity(options.verbose);

  const facilitatorPort = await resolvePort(options.port, options.portExplicit, "Facilitator");

  const presets = options.networks.map((n) => getNetwork(n));

  // Validate USDC support for all networks early
  for (const preset of presets) {
    getUsdcAddress(preset.chainId);
  }

  // Resolve ports for all Anvil instances
  const anvilPorts = await resolvePorts(
    options.anvilPort,
    presets.length,
    options.anvilPortExplicit,
    "Anvil",
  );

  const anvils: AnvilEntry[] = [];
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
    for (const anvil of anvils) {
      pending++;
      anvil.proc.stop().then(done, done);
    }
    anvils.length = 0;
    if (pending === 0) process.exit(0);

    // Force exit after 3s if graceful shutdown hangs
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const anvilTimeout = isFoundryInstalled() ? 30_000 : 120_000;

  // Start Anvil instances
  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const port = anvilPorts[i];
    const forkUrl = (i === 0 && options.rpcUrl) ? options.rpcUrl : preset.rpcUrl;

    console.log(
      chalk.dim(`Starting Anvil for ${preset.name} (chain ${preset.chainId}, port ${port})...`),
    );

    const proc = startAnvil({
      forkUrl,
      port,
      chainId: preset.chainId,
      host: options.anvilHost,
    });

    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(chalk.red(`Anvil (${preset.name}) exited with code ${code}`));
        process.exit(1);
      }
    });

    const localRpcUrl = `http://localhost:${port}`;
    anvils.push({ preset, port, localRpcUrl, proc });
  }

  // Wait for all Anvils to be ready (in parallel)
  console.log(chalk.dim(`Waiting for ${anvils.length} Anvil instance(s) to be ready...`));
  await Promise.all(
    anvils.map((anvil) => waitForAnvil(anvil.localRpcUrl, anvilTimeout)),
  );
  console.log(chalk.dim("All Anvil instances are ready."));

  // Build facilitator network config: forked chains use local Anvil, rest use remote
  const forkedChainIds = new Set(anvils.map((a) => a.preset.chainId));
  const allNetworks: NetworkConfig[] = [
    ...anvils.map((a) => ({ rpcUrl: a.localRpcUrl, chainId: a.preset.chainId })),
    ...Object.values(NETWORKS)
      .filter((p) => !forkedChainIds.has(p.chainId))
      .map((p) => ({ rpcUrl: p.rpcUrl, chainId: p.chainId })),
  ];

  // Start facilitator
  console.log(chalk.dim(`Starting facilitator on port ${facilitatorPort}...`));
  const facilitator = await startFacilitator({
    port: facilitatorPort,
    networks: allNetworks,
    privateKey: options.privateKey,
  });
  server = facilitator.server;

  // Print summary
  const anvilLines = anvils.map(
    (a) => `  ${a.preset.name.padEnd(14)} ${chalk.cyan(`http://localhost:${a.port}`)}`,
  );

  const networkLines = facilitator.networks.map((n) => {
    const isForked = forkedChainIds.has(n.chainId);
    const label = isForked ? chalk.green("anvil") : chalk.dim("remote");
    return `  ${n.network}  (${label})`;
  });

  const usdcLines = facilitator.networks.map((n) => {
    try {
      return `  ${n.network}  ${getUsdcAddress(n.chainId)}`;
    } catch {
      return `  ${n.network}  ${chalk.dim("n/a")}`;
    }
  });

  console.log(
    boxen(
      [
        chalk.dim("Anvil instances"),
        ...anvilLines,
        "",
        `${chalk.dim("Facilitator")}   ${chalk.cyan(`http://localhost:${facilitatorPort}`)}`,
        "",
        chalk.dim("Networks"),
        ...networkLines,
        "",
        chalk.dim("Accounts"),
        `  ${chalk.dim("Facilitator")}  ${facilitator.address}`,
        "",
        chalk.dim("USDC"),
        ...usdcLines,
        "",
        `${chalk.dim("Fund account with:")}`,
        `$ ${chalk.white("x402-fl fund <address> <amount> --anvil-port <port>")}`,
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
