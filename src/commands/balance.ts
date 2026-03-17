import chalk from "chalk";
import boxen from "boxen";
import type { Command } from "commander";
import { createPublicClient, fetchChainId } from "../lib/chain.js";
import {
  defaults,
  DEFAULT_DECIMALS,
  formatTokenAmount,
  getUsdcAddress,
  NETWORKS,
} from "../lib/config.js";
import { parseAddress, parsePort } from "../lib/parsers.js";
import { ERC20_ABI } from "../lib/abi.js";

export function register(program: Command) {
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
}

export interface BalanceOptions {
  address: `0x${string}`;
  anvilPort: number;
}

export async function balanceCommand(options: BalanceOptions): Promise<void> {
  const { address, anvilPort } = options;
  const rpcUrl = `http://localhost:${anvilPort}`;

  let chainId: number;
  try {
    chainId = await fetchChainId(rpcUrl);
  } catch {
    console.error(
      `Error: Could not connect to Anvil at ${rpcUrl}.\n` +
        `Make sure Anvil is running (e.g. "x402-fl dev" or "anvil --fork-url ...").`,
    );
    process.exit(1);
  }

  let usdcAddress: `0x${string}`;
  try {
    usdcAddress = getUsdcAddress(chainId);
  } catch {
    const supported = Object.values(NETWORKS)
      .map((n) => `${n.name} (${n.chainId})`)
      .join(", ");
    console.error(
      `Error: Unsupported chain ID ${chainId}. Supported networks: ${supported}.`,
    );
    process.exit(1);
  }
  const client = createPublicClient(rpcUrl, chainId);

  let decimals = DEFAULT_DECIMALS;
  try {
    decimals = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
  } catch {
    // Non-standard token without decimals(); fall back to default
  }

  const balance = await client.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  console.log(
    boxen(
      [
        `${chalk.dim("Token")}    ${usdcAddress}`,
        `${chalk.dim("Address")}  ${address}`,
        `${chalk.dim("Balance")}  ${chalk.green.bold(formatTokenAmount(balance, decimals))} USDC`,
      ].join("\n"),
      {
        title: "USDC Balance",
        padding: 1,
        borderStyle: "round",
        borderColor: "cyan",
      },
    ),
  );
}
