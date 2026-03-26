import type { SchemeNetworkFacilitator } from "@x402/core/types";
import type { FacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";

export type SchemeFactory = (
  signer: FacilitatorEvmSigner,
) => SchemeNetworkFacilitator;

const registry = new Map<string, SchemeFactory>();

registry.set("exact", (signer) => new ExactEvmScheme(signer));

export function registerScheme(name: string, factory: SchemeFactory): void {
  registry.set(name, factory);
}

export function getSchemeFactories(): ReadonlyMap<string, SchemeFactory> {
  return new Map(registry);
}
