import {
  GenericContainer,
  type StartedTestContainer,
  AbstractStartedContainer,
  Wait,
} from "testcontainers";
import { fundAddress, type FundResult } from "./fund.js";

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
}
