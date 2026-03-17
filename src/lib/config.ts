import { formatUnits, parseUnits } from "viem";
import { mnemonicToAccount } from "viem/accounts";

// Anvil default mnemonic — first account (index 0) is the facilitator
const ANVIL_MNEMONIC =
  "test test test test test test test test test test test junk";

const facilitatorAccount = mnemonicToAccount(ANVIL_MNEMONIC, {
  addressIndex: 0,
});

export const accounts = {
  facilitator: {
    address: facilitatorAccount.address,
    privateKey:
      `0x${Buffer.from(facilitatorAccount.getHdKey().privateKey!).toString("hex")}` as `0x${string}`,
  },
};

export const defaults = {
  anvilPort: 8545,
  facilitatorPort: 4022,
} as const;

export function networkId(chainId: number): `eip155:${number}` {
  return `eip155:${chainId}`;
}

// Base mainnet USDC
export const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

// Base Sepolia USDC
export const USDC_BASE_SEPOLIA_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

export type NetworkName = "base" | "base-sepolia";

export interface NetworkPreset {
  name: NetworkName;
  chainId: number;
  rpcUrl: string;
  usdcAddress: `0x${string}`;
}

export const NETWORKS: Record<NetworkName, NetworkPreset> = {
  base: {
    name: "base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    usdcAddress: USDC_ADDRESS,
  },
  "base-sepolia": {
    name: "base-sepolia",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    usdcAddress: USDC_BASE_SEPOLIA_ADDRESS,
  },
};

const USDC_BY_CHAIN: Record<number, `0x${string}`> = Object.fromEntries(
  Object.values(NETWORKS).map((n) => [n.chainId, n.usdcAddress]),
) as Record<number, `0x${string}`>;

export const DEFAULT_NETWORK: NetworkName = "base";

export function getNetwork(name: string): NetworkPreset {
  const preset = NETWORKS[name as NetworkName];
  if (!preset) {
    const available = Object.keys(NETWORKS).join(", ");
    throw new Error(`Unknown network "${name}". Available: ${available}`);
  }
  return preset;
}

export function getUsdcAddress(chainId: number): `0x${string}` {
  const addr = USDC_BY_CHAIN[chainId];
  if (!addr) {
    throw new Error(`Unsupported chain ID ${chainId} — no known USDC address.`);
  }
  return addr;
}

export const DEFAULT_DECIMALS = 6;

export function parseTokenAmount(
  amount: string,
  decimals = DEFAULT_DECIMALS,
): bigint {
  return parseUnits(amount, decimals);
}

export function formatTokenAmount(
  raw: bigint,
  decimals = DEFAULT_DECIMALS,
): string {
  return formatUnits(raw, decimals);
}
