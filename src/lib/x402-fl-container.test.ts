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
import {
  createWalletClient,
  http,
  parseEther,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createLocalChain } from "./chain.js";
import { GenericContainer } from "testcontainers";

describe("X402FacilitatorLocalContainer", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    const imageTag = `x402-fl-local:${Date.now()}`;
    await GenericContainer.fromDockerfile(".").build(imageTag);
    container = await new X402FacilitatorLocalContainer(imageTag).start();
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

  it("connects with viem and sends an ETH transfer", async () => {
    const rpcUrl = container.getRpcUrl();
    const chainId = await fetchChainId(rpcUrl);
    const chain = createLocalChain(rpcUrl, chainId);

    const account = privateKeyToAccount(accounts.facilitator.privateKey);
    // Use a fresh address with no pre-seeded Anvil balance
    const recipient = "0x000000000000000000000000000000000000bEEF" as `0x${string}`;

    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
      cacheTime: 0,
    }).extend(publicActions);

    const balanceBefore = await client.getBalance({ address: recipient });
    expect(balanceBefore).toBe(0n);

    const hash = await client.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const balanceAfter = await client.getBalance({ address: recipient });
    expect(balanceAfter).toBe(parseEther("1"));
  });

  it("withForkUrl is chainable", () => {
    const instance = new X402FacilitatorLocalContainer();
    const returned = instance.withForkUrl("http://localhost:8545");
    expect(returned).toBe(instance);
  });
});
