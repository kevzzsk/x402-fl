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
import {
  getUsdcAddress,
  formatTokenAmount,
  getNetwork,
  DEFAULT_NETWORK,
  type NetworkName,
} from "./config.js";
import type { BalanceResult } from "./types.js";

export type { BalanceResult };

const DEFAULT_ANVIL_PORT = 8545;
const DEFAULT_FACILITATOR_PORT = 4022;

export class X402FacilitatorLocalContainer extends GenericContainer {
  private networkNames: NetworkName[] = [];
  private forkUrl: string | undefined;
  private facilitatorPort: number = DEFAULT_FACILITATOR_PORT;
  private anvilPort: number = DEFAULT_ANVIL_PORT;
  private privateKey: string | undefined;
  private verbose: number = 0;

  constructor(image = "ghcr.io/kevzzsk/x402-fl:latest") {
    super(image);
    this.withStartupTimeout(120_000);
  }

  /** Select one or more named network presets (e.g. "base", "base-sepolia") for the container. */
  withNetworkPreset(...names: NetworkName[]): this {
    for (const name of names) getNetwork(name); // Validate eagerly
    this.networkNames = names;
    this.forkUrl = undefined;
    return this;
  }

  /** Override the fork RPC URL directly. Calling this clears any prior withNetworkPreset(). */
  withForkUrl(url: string): this {
    this.forkUrl = url;
    this.networkNames = [];
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

    if (this.networkNames.length > 0) {
      for (const name of this.networkNames) {
        cmd.push("--network", name);
      }
    } else if (this.forkUrl) {
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

    // Resolve the effective network list for port mapping
    const effectiveNetworks: NetworkName[] =
      this.networkNames.length > 0 ? this.networkNames : [DEFAULT_NETWORK];

    // Expose ports: facilitator + one Anvil port per network
    const portsToExpose: number[] = [this.facilitatorPort];
    for (let i = 0; i < effectiveNetworks.length; i++) {
      portsToExpose.push(this.anvilPort + i);
    }

    this.withExposedPorts(...portsToExpose)
      .withWaitStrategy(Wait.forHttp("/health", this.facilitatorPort));

    const started = await super.start();
    return new StartedX402FacilitatorLocalContainer(
      started,
      this.anvilPort,
      effectiveNetworks,
      this.facilitatorPort,
    );
  }
}

export class StartedX402FacilitatorLocalContainer extends AbstractStartedContainer {
  private cachedClients: Map<NetworkName, Promise<PublicClient>> = new Map();
  private readonly anvilPort: number;
  private readonly networkNames: NetworkName[];
  private readonly facilitatorPort: number;

  constructor(
    startedTestContainer: StartedTestContainer,
    anvilPort: number = DEFAULT_ANVIL_PORT,
    networkNames: NetworkName[] = [DEFAULT_NETWORK],
    facilitatorPort: number = DEFAULT_FACILITATOR_PORT,
  ) {
    super(startedTestContainer);
    this.anvilPort = anvilPort;
    this.networkNames = networkNames;
    this.facilitatorPort = facilitatorPort;
  }

  private resolveAnvilPort(network?: NetworkName): number {
    if (!network) {
      return this.anvilPort;
    }
    const index = this.networkNames.indexOf(network);
    if (index === -1) {
      const available = this.networkNames.join(", ");
      throw new Error(
        `Network "${network}" not configured. Available: ${available}`,
      );
    }
    return this.anvilPort + index;
  }

  /** Get the Anvil RPC URL. Pass a network name for multi-network setups. */
  getRpcUrl(network?: NetworkName): string {
    const port = this.resolveAnvilPort(network);
    return `http://${this.getHost()}:${this.getMappedPort(port)}`;
  }

  getFacilitatorUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(this.facilitatorPort)}`;
  }

  async fund(address: `0x${string}`, amount: string, network?: NetworkName): Promise<FundResult> {
    return fundAddress(this.getRpcUrl(network), address, amount);
  }

  getPublicClient(network?: NetworkName): Promise<PublicClient> {
    const key = network ?? this.networkNames[0];
    if (!this.cachedClients.has(key)) {
      const rpcUrl = this.getRpcUrl(network);
      this.cachedClients.set(
        key,
        fetchChainId(rpcUrl).then((chainId) => createPublicClient(rpcUrl, chainId)),
      );
    }
    return this.cachedClients.get(key)!;
  }

  async balance(address: `0x${string}`, network?: NetworkName): Promise<BalanceResult> {
    const client = await this.getPublicClient(network);
    const chainId = client.chain!.id;
    const usdcAddress = getUsdcAddress(chainId);

    const decimals = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const value = await client.readContract({
      address: usdcAddress,
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
