import {
  GenericContainer,
  type StartedTestContainer,
  AbstractStartedContainer,
  Wait,
} from "testcontainers";
import type { PublicClient } from "viem";
import { fundAddress, type FundResult } from "./fund.js";
import { fetchChainId, createPublicClient } from "./chain.js";
import { ERC20_ABI } from "./abi.js";
import { USDC_ADDRESS, DEFAULT_DECIMALS, formatTokenAmount, accounts } from "./config.js";

export interface BalanceResult {
  value: bigint;
  formatted: string;
  decimals: number;
}

export interface ContainerInfo {
  usdcAddress: `0x${string}`;
  chainId: number;
  facilitatorAddress: `0x${string}`;
  rpcUrl: string;
  facilitatorUrl: string;
  decimals: number;
}

const ANVIL_PORT = 8545;
const FACILITATOR_PORT = 4022;

export class X402FacilitatorLocalContainer extends GenericContainer {
  private forkUrl: string | undefined;

  constructor(image = "ghcr.io/kevzzsk/x402-fl:latest") {
    super(image);
    this.withExposedPorts(ANVIL_PORT, FACILITATOR_PORT)
      .withWaitStrategy(Wait.forHttp("/health", FACILITATOR_PORT))
      .withStartupTimeout(120_000);
  }

  withForkUrl(url: string): this {
    this.forkUrl = url;
    return this;
  }

  override async start(): Promise<StartedX402FacilitatorLocalContainer> {
    if (this.forkUrl) {
      this.withCommand(["--rpc-url", this.forkUrl]);
    }

    const started = await super.start();
    return new StartedX402FacilitatorLocalContainer(started);
  }
}

export class StartedX402FacilitatorLocalContainer extends AbstractStartedContainer {
  constructor(startedTestContainer: StartedTestContainer) {
    super(startedTestContainer);
  }

  getRpcUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(ANVIL_PORT)}`;
  }

  getFacilitatorUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(FACILITATOR_PORT)}`;
  }

  async fund(address: `0x${string}`, amount: string): Promise<FundResult> {
    return fundAddress(this.getRpcUrl(), address, amount);
  }

  async getPublicClient(): Promise<PublicClient> {
    const rpcUrl = this.getRpcUrl();
    const chainId = await fetchChainId(rpcUrl);
    return createPublicClient(rpcUrl, chainId);
  }

  async balance(address: `0x${string}`): Promise<BalanceResult> {
    const client = await this.getPublicClient();

    const decimals = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const value = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    return {
      value,
      formatted: formatTokenAmount(value, decimals),
      decimals,
    };
  }

  async info(): Promise<ContainerInfo> {
    const rpcUrl = this.getRpcUrl();
    const chainId = await fetchChainId(rpcUrl);
    return {
      usdcAddress: USDC_ADDRESS,
      chainId,
      facilitatorAddress: accounts.facilitator.address,
      rpcUrl,
      facilitatorUrl: this.getFacilitatorUrl(),
      decimals: DEFAULT_DECIMALS,
    };
  }
}
