import chalk from "chalk";
import boxen from "boxen";
import { Option, type Command } from "commander";
import { formatTokenAmount, getNetwork, NETWORKS, DEFAULT_NETWORK } from "../lib/config.js";
import { parseAddress, parseAmount } from "../lib/parsers.js";
import { fundAddress } from "../lib/fund.js";

export function register(program: Command) {
  program
    .command("fund")
    .description("Fund an address with USDC")
    .argument("<address>", "0x-prefixed Ethereum address to fund", parseAddress)
    .argument("<amount>", "USDC amount (e.g. '100' or '1.5')", parseAmount)
    .addOption(
      new Option("--network <name>", "network preset")
        .choices(Object.keys(NETWORKS))
        .default(DEFAULT_NETWORK),
    )
    .option("--rpc-url <url>", "RPC URL (overrides --network preset's default)")
    .addHelpText(
      "after",
      `
Examples:
  $ x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 100
  $ x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1.5 --network base-sepolia
  $ x402-fl fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 100 --rpc-url http://localhost:9545`,
    )
    .action(async (address: `0x${string}`, amount: string, opts) => {
      const rpcUrl = opts.rpcUrl ?? getNetwork(opts.network).rpcUrl;
      await fundCommand({
        address,
        amount,
        rpcUrl,
      });
    });
}

export interface FundOptions {
  address: `0x${string}`;
  amount: string;
  rpcUrl: string;
}

export async function fundCommand(options: FundOptions): Promise<void> {
  const { address, amount, rpcUrl } = options;

  let result: Awaited<ReturnType<typeof fundAddress>>;
  try {
    result = await fundAddress(rpcUrl, address, amount);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("fetch failed") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("Could not connect"))
    ) {
      console.error(
        `Error: Could not connect to RPC at ${rpcUrl}.\n` +
          `Make sure your RPC is reachable (e.g. "x402-fl dev" or pass --rpc-url).`,
      );
      process.exit(1);
    }
    throw err;
  }

  const decimals = result.decimals;

  const formatAmount = (raw: bigint) => formatTokenAmount(raw, decimals);

  console.log(
    boxen(
      [
        `${chalk.dim("Token")}    ${result.token}`,
        `${chalk.dim("Address")}  ${result.address}`,
        "",
        `${chalk.dim("Before")}   ${formatAmount(result.before)} USDC`,
        `${chalk.dim("Added")}    ${chalk.yellow("+" + formatAmount(result.added))} USDC`,
        `${chalk.dim("After")}    ${chalk.green.bold(formatAmount(result.after))} USDC`,
      ].join("\n"),
      {
        title: "Funded",
        padding: 1,
        borderStyle: "round",
        borderColor: "green",
      },
    ),
  );
}
