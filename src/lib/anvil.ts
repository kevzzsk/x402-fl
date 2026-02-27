import { execSync, spawn, type ChildProcess } from "child_process";
import { createPublicClient as viemCreatePublicClient, http } from "viem";

export interface AnvilOptions {
  forkUrl: string;
  port: number;
  chainId: number;
}

export function startAnvil(options: AnvilOptions): ChildProcess {
  try {
    execSync("which anvil", { stdio: "ignore" });
  } catch {
    console.error(
      "Error: `anvil` not found in PATH.\n\n" +
        "  Install Foundry: https://www.getfoundry.sh/introduction/installation\n" +
        "  Then run: foundryup",
    );
    process.exit(1);
  }

  const args = [
    "--fork-url", options.forkUrl,
    "--chain-id", String(options.chainId),
    "--port", String(options.port),
  ];

  const proc = spawn("anvil", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[anvil] ${line}`);
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.error(`[anvil] ${line}`);
  });

  return proc;
}

export async function waitForAnvil(rpcUrl: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  const client = viemCreatePublicClient({ transport: http(rpcUrl) });

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
