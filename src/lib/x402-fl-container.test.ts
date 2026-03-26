import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  fetchChainId,
  createPublicClient,
  accounts,
  getUsdcAddress,
} from "../testcontainers.js";
import { ERC20_ABI } from "./abi.js";
import { createWalletClient, http, parseEther, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createLocalChain } from "./chain.js";
import { GenericContainer } from "testcontainers";

const imageTag = `x402-fl-local:${Date.now()}`;

beforeAll(async () => {
  await GenericContainer.fromDockerfile(".").build(imageTag);
}, 120_000);

describe("X402FacilitatorLocalContainer", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
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

    const usdcAddress = getUsdcAddress(chainId);

    const before = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    await container.fund(address, "100");

    const after = await client.readContract({
      address: usdcAddress,
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
    const recipient =
      "0x000000000000000000000000000000000000bEEF" as `0x${string}`;

    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
      cacheTime: 0,
    }).extend(publicActions);

    const balanceBefore = await client.getBalance({ address: recipient });
    expect(balanceBefore).toStrictEqual(0n);

    const hash = await client.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });

    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toStrictEqual("success");

    const balanceAfter = await client.getBalance({ address: recipient });
    expect(balanceAfter).toStrictEqual(parseEther("1"));
  });

  it("balance() returns the USDC balance for an address", async () => {
    const address = accounts.facilitator.address;
    await container.fund(address, "50");

    const result = await container.balance(address);

    expect(result.value).toBeGreaterThanOrEqual(50_000_000n);
    expect(result.formatted).toBeDefined();
    expect(result.decimals).toStrictEqual(6);
  });

  it("getPublicClient() returns a working viem client", async () => {
    const client = await container.getPublicClient();
    const chainId = await client.getChainId();
    expect(chainId).toStrictEqual(8453);
  });

  it("/health returns all networks regardless of Anvil fork", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    const body = await res.json();
    expect(body.networks).toBeInstanceOf(Array);
    expect(body.networks).toContain("eip155:8453");
    expect(body.networks).toContain("eip155:84532");
  });

  it("/supported lists exact scheme for all networks", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/supported`);
    const body = await res.json();
    expect(body.kinds).toBeInstanceOf(Array);

    const exactOnBase = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:8453",
    );
    expect(exactOnBase).toBeDefined();
    expect(exactOnBase.x402Version).toStrictEqual(2);

    const exactOnSepolia = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:84532",
    );
    expect(exactOnSepolia).toBeDefined();
  });

  it("/supported includes signers for eip155 family", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/supported`);
    const body = await res.json();
    expect(body.signers).toBeDefined();
    expect(body.signers["eip155:*"]).toBeInstanceOf(Array);
    expect(body.signers["eip155:*"].length).toBeGreaterThanOrEqual(1);
  });

  it("all builder methods are chainable", () => {
    const instance = new X402FacilitatorLocalContainer();
    const returned = instance
      .withNetworkPreset("base-sepolia")
      .withForkUrl("http://localhost:8545")
      .withPort(9000)
      .withAnvilPort(9545)
      .withPrivateKey(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      )
      .withVerbose(1);
    expect(returned).toStrictEqual(instance);
  });
});

describe("X402FacilitatorLocalContainer (Base Sepolia)", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    container = await new X402FacilitatorLocalContainer(imageTag)
      .withNetworkPreset("base-sepolia")
      .start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("chain ID is 84532", async () => {
    const chainId = await fetchChainId(container.getRpcUrl());
    expect(chainId).toStrictEqual(84532);
  });

  it("health endpoint returns 200", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    expect(res.status).toStrictEqual(200);
  });

  it("USDC funding works", async () => {
    const address = accounts.facilitator.address;
    const rpcUrl = container.getRpcUrl();
    const chainId = await fetchChainId(rpcUrl);
    const client = createPublicClient(rpcUrl, chainId);
    const usdcAddress = getUsdcAddress(chainId);

    const before = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    await container.fund(address, "100");

    const after = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    expect(after - before).toStrictEqual(100_000_000n);
  });

  it("balance() returns correct result", async () => {
    const address = accounts.facilitator.address;
    await container.fund(address, "50");

    const result = await container.balance(address);

    expect(result.value).toBeGreaterThanOrEqual(50_000_000n);
    expect(result.formatted).toBeDefined();
    expect(result.decimals).toStrictEqual(6);
  });

  it("getPublicClient() returns Base Sepolia chain ID", async () => {
    const client = await container.getPublicClient();
    const chainId = await client.getChainId();
    expect(chainId).toStrictEqual(84532);
  });

  it("/health returns all networks even when Anvil forks base-sepolia", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    const body = await res.json();
    expect(body.networks).toContain("eip155:84532");
    expect(body.networks).toContain("eip155:8453");
  });

  it("/supported lists exact scheme for all networks", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/supported`);
    const body = await res.json();
    const exactOnSepolia = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:84532",
    );
    expect(exactOnSepolia).toBeDefined();

    const exactOnBase = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:8453",
    );
    expect(exactOnBase).toBeDefined();
  });
});

describe("X402FacilitatorLocalContainer with custom options", () => {
  // Anvil account 1
  const CUSTOM_PRIVATE_KEY =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const expectedAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const CUSTOM_FACILITATOR_PORT = 5000;
  const CUSTOM_ANVIL_PORT = 9545;

  let customContainer: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    customContainer = await new X402FacilitatorLocalContainer(imageTag)
      .withPort(CUSTOM_FACILITATOR_PORT)
      .withAnvilPort(CUSTOM_ANVIL_PORT)
      .withPrivateKey(CUSTOM_PRIVATE_KEY)
      .withVerbose(1)
      .start();
  });

  afterAll(async () => {
    await customContainer?.stop();
  });

  it("withPort() sets the custom facilitator port", async () => {
    const res = await fetch(`${customContainer.getFacilitatorUrl()}/health`);
    expect(res.status).toStrictEqual(200);
  });

  it("withAnvilPort() sets the custom anvil port", async () => {
    const chainId = await fetchChainId(customContainer.getRpcUrl());
    expect(chainId).toStrictEqual(8453);
  });

  it("withPrivateKey() sets the custom facilitator address", async () => {
    const res = await fetch(`${customContainer.getFacilitatorUrl()}/health`);
    const body = await res.json();
    expect(body.facilitator.toLowerCase()).toStrictEqual(
      expectedAddress.toLowerCase(),
    );
  });
});

describe("X402FacilitatorLocalContainer (multi-network)", () => {
  let container: StartedX402FacilitatorLocalContainer;

  beforeAll(async () => {
    container = await new X402FacilitatorLocalContainer(imageTag)
      .withNetworkPreset("base", "base-sepolia")
      .start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("Base Anvil returns correct chain ID", async () => {
    const chainId = await fetchChainId(container.getRpcUrl("base"));
    expect(chainId).toStrictEqual(8453);
  });

  it("Base Sepolia Anvil returns correct chain ID", async () => {
    const chainId = await fetchChainId(container.getRpcUrl("base-sepolia"));
    expect(chainId).toStrictEqual(84532);
  });

  it("getRpcUrl() without args returns first network", async () => {
    const chainId = await fetchChainId(container.getRpcUrl());
    expect(chainId).toStrictEqual(8453);
  });

  it("facilitator health shows all networks", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/health`);
    const body = await res.json();
    expect(body.networks).toContain("eip155:8453");
    expect(body.networks).toContain("eip155:84532");
  });

  it("funding works on both networks by name", async () => {
    const address = accounts.facilitator.address;

    await container.fund(address, "50", "base");
    const baseBalance = await container.balance(address, "base");
    expect(baseBalance.value).toBeGreaterThanOrEqual(50_000_000n);

    await container.fund(address, "50", "base-sepolia");
    const sepoliaBalance = await container.balance(address, "base-sepolia");
    expect(sepoliaBalance.value).toBeGreaterThanOrEqual(50_000_000n);
  });

  it("/supported lists exact scheme for both networks", async () => {
    const res = await fetch(`${container.getFacilitatorUrl()}/supported`);
    const body = await res.json();

    const exactOnBase = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:8453",
    );
    expect(exactOnBase).toBeDefined();

    const exactOnSepolia = body.kinds.find(
      (k: { scheme: string; network: string }) =>
        k.scheme === "exact" && k.network === "eip155:84532",
    );
    expect(exactOnSepolia).toBeDefined();
  });
});
