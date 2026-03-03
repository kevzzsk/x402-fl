import {
  createTestClient,
  http,
  publicActions,
  keccak256,
  encodePacked,
  pad,
  toHex,
} from "viem";
import { createLocalChain, fetchChainId } from "./chain.js";
import { DEFAULT_DECIMALS, parseTokenAmount, USDC_ADDRESS } from "./config.js";
import { ERC20_ABI } from "./abi.js";

export interface FundResult {
  before: bigint;
  added: bigint;
  after: bigint;
  address: `0x${string}`;
  token: `0x${string}`;
  decimals: number;
}

const SENTINEL_VALUE = 31337n * 10n ** 18n;
const SENTINEL_STORAGE = pad(toHex(SENTINEL_VALUE), { size: 32 });

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

async function anvilSetStorageAt(
  client: ReturnType<typeof createTestClient> & ReturnType<typeof publicActions>,
  address: `0x${string}`,
  slot: `0x${string}`,
  value: `0x${string}`,
): Promise<void> {
  await client.request({
    method: "anvil_setStorageAt" as any,
    params: [address, slot, value] as any,
  });
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
  for (let slot = 0; slot <= 20; slot++) {
    const storageKey = balanceSlot(probeAddress, slot);

    const original = await client.getStorageAt({
      address: contractAddress,
      slot: storageKey,
    });

    await anvilSetStorageAt(client, contractAddress, storageKey, SENTINEL_STORAGE);

    let matched = false;
    try {
      const balance = await client.readContract({
        address: contractAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [probeAddress],
      });
      matched = balance === SENTINEL_VALUE;
    } finally {
      await anvilSetStorageAt(
        client, contractAddress, storageKey,
        original ?? pad("0x0", { size: 32 }),
      );
    }

    if (matched) return slot;
  }

  throw new Error(
    `Could not detect balanceOf storage slot for contract ${contractAddress}. ` +
      `Probed slots 0-20 with no match.`
  );
}

/**
 * Fund any address with ERC-20 tokens by directly manipulating Anvil storage.
 * Pure function — no CLI dependencies.
 */
export async function fundAddress(
  rpcUrl: string,
  address: `0x${string}`,
  amount: string,
  tokenAddress: `0x${string}` = USDC_ADDRESS,
): Promise<FundResult> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    throw new Error(`Invalid amount: "${amount}". Must be a positive number (e.g. "100" or "1.5").`);
  }

  const chainId = await fetchChainId(rpcUrl);
  const chain = createLocalChain(rpcUrl, chainId);
  const client = createTestClient({
    mode: "anvil",
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions);

  let decimals = DEFAULT_DECIMALS;
  try {
    decimals = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("revert") || msg.includes("missing revert data")) {
      // Token doesn't implement decimals(); use default
    } else {
      throw err;
    }
  }

  const before = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  const baseSlot = await findBalanceSlot(client, tokenAddress, address);
  const addAmount = parseTokenAmount(amount, decimals);
  const newBalance = before + addAmount;

  const storageKey = balanceSlot(address, baseSlot);
  const encodedBalance = pad(toHex(newBalance), { size: 32 });

  await anvilSetStorageAt(client, tokenAddress, storageKey, encodedBalance);

  const after = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  if (after !== newBalance) {
    throw new Error(
      `Balance mismatch after storage write. Expected: ${newBalance}, Got: ${after}`
    );
  }

  return { before, added: addAmount, after, address, token: tokenAddress, decimals };
}
