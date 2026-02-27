import {
  createPublicClient as viemCreatePublicClient,
  createWalletClient as viemCreateWalletClient,
  defineChain,
  http,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function fetchChainId(rpcUrl: string): Promise<number> {
  const client = viemCreatePublicClient({ transport: http(rpcUrl) });
  return client.getChainId();
}

export function createLocalChain(rpcUrl: string, chainId: number) {
  return defineChain({
    id: chainId,
    name: "Local Anvil Fork",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

export function createPublicClient(rpcUrl: string, chainId: number) {
  return viemCreatePublicClient({
    chain: createLocalChain(rpcUrl, chainId),
    transport: http(rpcUrl),
  });
}

export function createWalletClient(privateKey: `0x${string}`, rpcUrl: string, chainId: number) {
  const account = privateKeyToAccount(privateKey);
  return viemCreateWalletClient({
    account,
    chain: createLocalChain(rpcUrl, chainId),
    transport: http(rpcUrl),
  }).extend(publicActions);
}
