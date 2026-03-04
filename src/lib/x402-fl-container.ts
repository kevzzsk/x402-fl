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
import { USDC_ADDRESS, formatTokenAmount } from "./config.js";

export interface BalanceResult {
  value: bigint;
  formatted: string;
  decimals: number;
}

const DEFAULT_ANVIL_PORT = 8545;
const DEFAULT_FACILITATOR_PORT = 4022;

export class X402FacilitatorLocalContainer extends GenericContainer {
  private forkUrl: string | undefined;
  private facilitatorPort: number = DEFAULT_FACILITATOR_PORT;
  private anvilPort: number = DEFAULT_ANVIL_PORT;
  private privateKey: string | undefined;
  private verbose: number = 0;

  constructor(image = "ghcr.io/kevzzsk/x402-fl:latest") {
    super(image);
    this.withStartupTimeout(120_000);
  }

  withForkUrl(url: string): this {
    this.forkUrl = url;
    return this;
  }

  withPort(port: number): this {
    this.facilitatorPort = port;
    return this;
  }

  withAnvilPort(port: number): this {
    this.anvilPort = port;
    return this;
  }

  withPrivateKey(key: string): this {
    this.privateKey = key;
    return this;
  }

  withVerbose(level: number = 1): this {
    this.verbose = level;
    return this;
  }

  override async start(): Promise<StartedX402FacilitatorLocalContainer> {
    const cmd: string[] = [];

    if (this.forkUrl) {
      cmd.push("--rpc-url", this.forkUrl);
    }
    if (this.facilitatorPort !== DEFAULT_FACILITATOR_PORT) {
      cmd.push("--port", String(this.facilitatorPort));
    }
    if (this.anvilPort !== DEFAULT_ANVIL_PORT) {
      cmd.push("--anvil-port", String(this.anvilPort));
    }
    if (this.privateKey) {
      cmd.push("--private-key", this.privateKey);
    }
    if (this.verbose > 0) {
      cmd.push("-" + "v".repeat(this.verbose));
    }

    if (cmd.length > 0) {
      this.withCommand(cmd);
    }

    this.withExposedPorts(this.anvilPort, this.facilitatorPort)
      .withWaitStrategy(Wait.forHttp("/health", this.facilitatorPort));

    const started = await super.start();
    return new StartedX402FacilitatorLocalContainer(
      started,
      this.anvilPort,
      this.facilitatorPort,
    );
  }
}

export class StartedX402FacilitatorLocalContainer extends AbstractStartedContainer {
  private cachedClient: Promise<PublicClient> | undefined;
  private readonly anvilPort: number;
  private readonly facilitatorPort: number;

  constructor(
    startedTestContainer: StartedTestContainer,
    anvilPort: number = DEFAULT_ANVIL_PORT,
    facilitatorPort: number = DEFAULT_FACILITATOR_PORT,
  ) {
    super(startedTestContainer);
    this.anvilPort = anvilPort;
    this.facilitatorPort = facilitatorPort;
  }

  getRpcUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(this.anvilPort)}`;
  }

  getFacilitatorUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(this.facilitatorPort)}`;
  }

  async fund(address: `0x${string}`, amount: string): Promise<FundResult> {
    return fundAddress(this.getRpcUrl(), address, amount);
  }

  getPublicClient(): Promise<PublicClient> {
    if (!this.cachedClient) {
      const rpcUrl = this.getRpcUrl();
      this.cachedClient = fetchChainId(rpcUrl).then((chainId) =>
        createPublicClient(rpcUrl, chainId),
      );
    }
    return this.cachedClient;
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
}
