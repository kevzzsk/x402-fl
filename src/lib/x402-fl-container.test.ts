import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  fetchChainId,
  createPublicClient,
  accounts,
  USDC_ADDRESS,
} from "../testcontainers.js";
import { ERC20_ABI } from "./abi.js";

describe("X402FacilitatorLocalContainer", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    container = await new X402FacilitatorLocalContainer().start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("exposes an Anvil RPC endpoint that returns a chain ID", async () => {
    const chainId = await fetchChainId(container.getRpcUrl());
    expect(chainId).toStrictEqual(8453);
  });

  it("exposes a facilitator health endpoint that returns 200", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    expect(res.status).toStrictEqual(200);
  });

  it("funds an address with USDC and increases the balance", async () => {
    const address = accounts.facilitator.address;
    const rpcUrl = container.getRpcUrl();
    const chainId = await fetchChainId(rpcUrl);
    const client = createPublicClient(rpcUrl, chainId);

    const before = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    await container.fund(address, "100");

    const after = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    expect(after - before).toStrictEqual(100_000_000n);
  });

  it("withForkUrl is chainable", () => {
    const instance = new X402FacilitatorLocalContainer();
    const returned = instance.withForkUrl("http://localhost:8545");
    expect(returned).toBe(instance);
  });
});
