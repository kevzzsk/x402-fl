import chalk from "chalk";
import boxen from "boxen";
import { Option, type Command } from "commander";
import { createPublicClient, fetchChainId } from "../lib/chain.js";
import {
  DEFAULT_DECIMALS,
  DEFAULT_NETWORK,
  formatTokenAmount,
  getNetwork,
  getUsdcAddress,
  NETWORKS,
} from "../lib/config.js";
import { parseAddress } from "../lib/parsers.js";
import { ERC20_ABI } from "../lib/abi.js";

export function register(program: Command) {
  program
    .command("balance")
    .description("Get USDC balance for an address")
    .argument("<address>", "0x-prefixed Ethereum address to check", parseAddress)
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
  $ x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  $ x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --network base-sepolia
  $ x402-fl balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:9545`,
    )
    .action(async (address: `0x${string}`, opts) => {
      const rpcUrl = opts.rpcUrl ?? getNetwork(opts.network).rpcUrl;
      await balanceCommand({
        address,
        rpcUrl,
      });
    });
}

export interface BalanceOptions {
  address: `0x${string}`;
  rpcUrl: string;
}

export async function balanceCommand(options: BalanceOptions): Promise<void> {
  const { address, rpcUrl } = options;

  let chainId: number;
  try {
    chainId = await fetchChainId(rpcUrl);
  } catch {
    console.error(
      `Error: Could not connect to RPC at ${rpcUrl}.\n` +
        `Make sure your RPC is reachable (e.g. "x402-fl dev" or pass --rpc-url).`,
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
