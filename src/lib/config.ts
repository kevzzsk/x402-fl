import { mnemonicToAccount } from "viem/accounts";

// Anvil default mnemonic — first account (index 0) is the facilitator
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

const facilitatorAccount = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });

export const accounts = {
  facilitator: {
    address: facilitatorAccount.address,
    privateKey: `0x${Buffer.from(facilitatorAccount.getHdKey().privateKey!).toString("hex")}` as `0x${string}`,
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
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

export const DEFAULT_DECIMALS = 6;

export function parseTokenAmount(amount: string, decimals = DEFAULT_DECIMALS): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + padded);
}

export function formatTokenAmount(raw: bigint, decimals = DEFAULT_DECIMALS): string {
  const str = raw.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, -decimals);
  const frac = str.slice(-decimals).replace(/0+$/, "") || "0";
  return `${whole}.${frac}`;
}
