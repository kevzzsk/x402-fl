import chalk from "chalk";
import boxen from "boxen";
import { createPublicClient, fetchChainId } from "../lib/chain.js";
import {
  DEFAULT_DECIMALS,
  formatTokenAmount,
  USDC_ADDRESS,
} from "../lib/config.js";
import { ERC20_ABI } from "../lib/abi.js";

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

  const client = createPublicClient(rpcUrl, chainId);

  let decimals = DEFAULT_DECIMALS;
  try {
    decimals = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
  } catch {
    // Non-standard token without decimals(); fall back to default
  }

  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  console.log(
    boxen(
      [
        `${chalk.dim("Token")}    ${USDC_ADDRESS}`,
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
