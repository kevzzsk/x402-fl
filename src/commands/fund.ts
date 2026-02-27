import chalk from "chalk";
import boxen from "boxen";
import {
  createTestClient,
  http,
  publicActions,
  keccak256,
  encodePacked,
  pad,
  toHex,
} from "viem";
import { createLocalChain, fetchChainId } from "../lib/chain.js";
import { DEFAULT_DECIMALS, formatTokenAmount, parseTokenAmount, USDC_ADDRESS } from "../lib/config.js";
import { ERC20_ABI } from "../lib/abi.js";

export interface FundOptions {
  address: `0x${string}`;
  amount: string;
  anvilPort: number;
}

/**
 * Compute the storage slot for `mapping(address => uint256)` at a given
 * base slot index.  Solidity stores mapping values at keccak256(key . slot).
 */
function balanceSlot(address: `0x${string}`, baseSlot: number): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "bytes32"],
      [pad(address, { size: 32 }), pad(toHex(baseSlot), { size: 32 })]
    )
  );
}

/**
 * Probe common mapping slots (0-20) to find the correct `balanceOf` storage
 * slot for an arbitrary ERC-20 contract.
 *
 * Strategy: for each candidate base slot we write a known sentinel value into
 * the computed mapping slot, then check whether `balanceOf` returns that
 * sentinel.  The original value is always restored before moving on.
 */
async function findBalanceSlot(
  client: ReturnType<typeof createTestClient> & ReturnType<typeof publicActions>,
  contractAddress: `0x${string}`,
  probeAddress: `0x${string}`
): Promise<number> {
  const sentinel = pad(toHex(31337n * 10n ** 18n), { size: 32 });

  for (let slot = 0; slot <= 20; slot++) {
    const storageKey = balanceSlot(probeAddress, slot);

    // Save the original value so we can restore it.
    const original = await client.getStorageAt({
      address: contractAddress,
      slot: storageKey,
    });

    // Write sentinel
    await client.request({
      method: "anvil_setStorageAt" as any,
      params: [contractAddress, storageKey, sentinel] as any,
    });

    // Read balanceOf and see if it matches
    const balance = await client.readContract({
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [probeAddress],
    });

    // Restore original value regardless of outcome
    await client.request({
      method: "anvil_setStorageAt" as any,
      params: [contractAddress, storageKey, original ?? pad("0x0", { size: 32 })] as any,
    });

    if (balance === 31337n * 10n ** 18n) {
      return slot;
    }
  }

  throw new Error(
    `Could not detect balanceOf storage slot for contract ${contractAddress}. ` +
      `Probed slots 0-20 with no match.`
  );
}

/**
 * Fund any address with ERC-20 tokens by directly manipulating Anvil storage.
 */
export async function fundCommand(options: FundOptions): Promise<void> {
  const { address, amount, anvilPort } = options;
  const contractAddress = USDC_ADDRESS;
  const rpcUrl = `http://localhost:${anvilPort}`;

  // Detect chain ID from running Anvil instance
  let chainId: number;
  try {
    chainId = await fetchChainId(rpcUrl);
  } catch {
    console.error(
      `Error: Could not connect to Anvil at ${rpcUrl}.\n` +
        `Make sure Anvil is running (e.g. "x402-fl dev" or "anvil --fork-url ...").`
    );
    process.exit(1);
  }

  // Create a viem TestClient (Anvil mode) with public actions
  const chain = createLocalChain(rpcUrl, chainId);
  const client = createTestClient({
    mode: "anvil",
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions);

  // Read token decimals from ERC-20 metadata, default to 6
  let decimals = DEFAULT_DECIMALS;
  try {
    decimals = await client.readContract({
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
  } catch {
    // Non-standard token without decimals(); fall back to default
  }

  const formatAmount = (raw: bigint) => formatTokenAmount(raw, decimals);

  // Read current balance
  const before = await client.readContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  // Detect the storage slot
  const baseSlot = await findBalanceSlot(client, contractAddress, address);

  const addAmount = parseTokenAmount(amount, decimals);
  const newBalance = before + addAmount;

  // Write the new balance to storage
  const storageKey = balanceSlot(address, baseSlot);
  const encodedBalance = pad(toHex(newBalance), { size: 32 });

  await client.request({
    method: "anvil_setStorageAt" as any,
    params: [contractAddress, storageKey, encodedBalance] as any,
  });

  // Verify the balance was updated correctly
  const after = await client.readContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  if (after !== newBalance) {
    console.error(
      `Warning: Balance mismatch after storage write.\n` +
        `  Expected: ${formatAmount(newBalance)}\n` +
        `  Got:      ${formatAmount(after)}`
    );
  }

  // Print confirmation
  console.log(boxen(
    [
      `${chalk.dim("Token")}    ${contractAddress}`,
      `${chalk.dim("Address")}  ${address}`,
      "",
      `${chalk.dim("Before")}   ${formatAmount(before)} USDC`,
      `${chalk.dim("Added")}    ${chalk.yellow("+" + formatAmount(addAmount))} USDC`,
      `${chalk.dim("After")}    ${chalk.green.bold(formatAmount(after))} USDC`,
    ].join("\n"),
    { title: "Funded", padding: 1, borderStyle: "round", borderColor: "green" },
  ));
}
