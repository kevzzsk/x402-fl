import {
  execSync,
  execFileSync,
  spawn,
} from "child_process";
import { createPublicClient as viemCreatePublicClient, http } from "viem";
import { Instance } from "prool";
import chalk from "chalk";
import boxen from "boxen";
import { verboseLog2 } from "./log.js";

const whichCmd = process.platform === "win32" ? "where" : "which";

export interface AnvilOptions {
  forkUrl: string;
  port: number;
  chainId: number;
  host?: string;
}

export interface AnvilInstance {
  stop(): Promise<void>;
  on(event: "exit", listener: (code: number | null) => void): void;
}

export function isFoundryInstalled(): boolean {
  try {
    execSync(`${whichCmd} anvil`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isDockerAvailable(): boolean {
  try {
    execSync(`${whichCmd} docker`, { stdio: "ignore" });
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function startAnvil(options: AnvilOptions): AnvilInstance {
  if (isFoundryInstalled()) {
    return startNativeAnvil(options);
  }

  if (isDockerAvailable()) {
    console.log(
      boxen(
        [
          `${chalk.yellow("Foundry not found")} — using Docker fallback`,
          "",
          "Anvil is running inside a Docker container.",
          "For better performance, install Foundry natively:",
          chalk.cyan("https://www.getfoundry.sh/introduction/installation"),
        ].join("\n"),
        {
          padding: 1,
          borderStyle: "round",
          borderColor: "yellow",
          title: "Docker Fallback",
        },
      ),
    );
    return startDockerAnvil(options);
  }

  throw new Error(
    "Cannot start Anvil — neither Foundry nor Docker is available.\n" +
    "Install Foundry: https://www.getfoundry.sh/introduction/installation\n" +
    "Or install Docker: https://docs.docker.com/get-docker/"
  );
}

function startNativeAnvil(options: AnvilOptions): AnvilInstance {
  const instance = Instance.anvil({
    forkUrl: options.forkUrl,
    chainId: options.chainId,
    port: options.port,
    host: options.host ?? "127.0.0.1",
  });

  instance.on("stdout", (msg) => verboseLog2(`[anvil] ${msg}`));
  instance.on("stderr", (msg) => verboseLog2(`[anvil] ${msg}`));

  // Start is async but we return the instance immediately
  // (matches previous spawn behavior — caller uses waitForAnvil).
  // Attach .catch() to surface startup failures instead of crashing with
  // an unhandled rejection.
  instance.start().catch((err) => {
    throw new Error(`Failed to start Anvil: ${err}`);
  });

  return {
    stop: () => instance.stop(),
    on: (event, listener) => {
      if (event === "exit") {
        instance.on("exit", (code) => listener(code));
      }
    },
  };
}

function startDockerAnvil(options: AnvilOptions): AnvilInstance {
  const containerName = `x402-fl-anvil-${options.port}`;
  const args = [
    "run",
    "--rm",
    "--name",
    containerName,
    "-p",
    `${options.port}:8545`,
    "--entrypoint",
    "anvil",
    "ghcr.io/foundry-rs/foundry:v1.5.0",
    "--host",
    "0.0.0.0",
    "--fork-url",
    options.forkUrl,
    "--chain-id",
    String(options.chainId),
  ];

  const proc = spawn("docker", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil:docker] ${line}`);
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil:docker] ${line}`);
  });

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        // If the process already exited, resolve immediately to avoid hanging.
        if (proc.exitCode !== null) {
          resolve();
          return;
        }
        proc.on("exit", () => resolve());
        try {
          execFileSync("docker", ["stop", "--time", "3", containerName], {
            stdio: "ignore",
            timeout: 5000,
          });
        } catch {
          // Container may already be stopped
        }
        proc.kill("SIGTERM");
      }),
    on: (event, listener) => {
      if (event === "exit") {
        proc.on("exit", (code) => listener(code));
      }
    },
  };
}

export async function waitForAnvil(
  rpcUrl: string,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  const client = viemCreatePublicClient({
    transport: http(rpcUrl, { timeout: 2_000 }),
  });

  while (Date.now() - start < timeoutMs) {
    try {
      const chainId = await client.getChainId();
      if (chainId) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Anvil did not become ready within ${timeoutMs}ms`);
}
