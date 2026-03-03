import {
  execSync,
  execFileSync,
  spawn,
  type ChildProcess,
} from "child_process";
import { createPublicClient as viemCreatePublicClient, http } from "viem";
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

export function startAnvil(options: AnvilOptions): ChildProcess {
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

  console.error(
    [
      chalk.red(
        "Error: Cannot start Anvil — neither Foundry nor Docker is available.",
      ),
      "",
      "  Option 1 (recommended): Install Foundry",
      `    ${chalk.cyan("https://www.getfoundry.sh/introduction/installation")}`,
      "",
      "  Option 2: Install Docker",
      `    ${chalk.cyan("https://docs.docker.com/get-docker/")}`,
    ].join("\n"),
  );
  process.exit(1);
}

function startNativeAnvil(options: AnvilOptions): ChildProcess {
  const args = [
    "--fork-url",
    options.forkUrl,
    "--chain-id",
    String(options.chainId),
    "--port",
    String(options.port),
    "--host",
    options.host ?? "127.0.0.1",
  ];

  const proc = spawn("anvil", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil] ${line}`);
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil] ${line}`);
  });

  return proc;
}

function startDockerAnvil(options: AnvilOptions): ChildProcess {
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

  const originalKill = proc.kill.bind(proc);
  proc.kill = (signal?: NodeJS.Signals | number): boolean => {
    try {
      execFileSync("docker", ["stop", "--time", "3", containerName], {
        stdio: "ignore",
        timeout: 5000,
      });
    } catch {
      // Container may already be stopped
    }
    return originalKill(signal);
  };

  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil:docker] ${line}`);
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) verboseLog2(`[anvil:docker] ${line}`);
  });

  return proc;
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
