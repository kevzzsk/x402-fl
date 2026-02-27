import chalk from "chalk";
import boxen from "boxen";
import type { ChildProcess } from "child_process";
import type { Server } from "http";
import { startAnvil, waitForAnvil } from "../lib/anvil.js";
import { startFacilitator } from "../lib/facilitator.js";
import { fetchChainId } from "../lib/chain.js";
import { accounts, networkId, USDC_ADDRESS } from "../lib/config.js";
import { resolvePort } from "../lib/port.js";

export interface DevOptions {
  port: number;
  anvilPort: number;
  rpcUrl: string;
  portExplicit: boolean;
  anvilPortExplicit: boolean;
}

export async function devCommand(options: DevOptions): Promise<void> {
  const anvilPort = await resolvePort(options.anvilPort, options.anvilPortExplicit, "Anvil");
  const facilitatorPort = await resolvePort(options.port, options.portExplicit, "Facilitator");

  const localRpcUrl = `http://localhost:${anvilPort}`;
  let anvilProc: ChildProcess | null = null;
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
      anvilProc.on("exit", () => done());
      anvilProc.kill("SIGTERM");
      anvilProc = null;
    }
    if (pending === 0) process.exit(0);

    // Force exit after 3s if graceful shutdown hangs
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 0. Detect chain ID from fork RPC
  console.log(chalk.dim(`Detecting chain ID from ${options.rpcUrl}...`));
  const chainId = await fetchChainId(options.rpcUrl);
  console.log(chalk.dim(`Detected chain ID: ${chainId}`));

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
  });

  anvilProc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(chalk.red(`Anvil exited with code ${code}`));
      process.exit(1);
    }
  });

  // 2. Wait for Anvil to be ready
  console.log(chalk.dim("Waiting for Anvil to be ready..."));
  await waitForAnvil(localRpcUrl);
  console.log(chalk.dim("Anvil is ready."));

  // 3. Start facilitator
  console.log(chalk.dim(`Starting facilitator on port ${facilitatorPort}...`));
  server = await startFacilitator({
    port: facilitatorPort,
    rpcUrl: localRpcUrl,
    chainId,
  });

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
        `  ${chalk.dim("Facilitator")}  ${accounts.facilitator.address}`,
        "",
        `${chalk.dim("USDC")}          ${USDC_ADDRESS}`,
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
