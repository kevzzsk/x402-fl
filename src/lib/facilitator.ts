import express from "express";
import type { Server } from "http";
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { createWalletClient } from "./chain.js";
import { accounts, networkId } from "./config.js";
import { verboseLog1 } from "./log.js";
import { getSchemeFactories } from "./schemes.js";

export interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
}

export interface FacilitatorOptions {
  port: number;
  networks: NetworkConfig[];
  privateKey?: `0x${string}`;
}

export interface FacilitatorResult {
  server: Server;
  address: `0x${string}`;
  networks: readonly { network: string; chainId: number }[];
}

export function startFacilitator(
  options: FacilitatorOptions,
): Promise<FacilitatorResult> {
  const privateKey = options.privateKey ?? accounts.facilitator.privateKey;

  const facilitator = new x402Facilitator();
  const schemeFactories = getSchemeFactories();
  const registeredNetworks: Array<{ network: string; chainId: number }> = [];

  let address: `0x${string}` | undefined;

  for (const net of options.networks) {
    const viemClient = createWalletClient(privateKey, net.rpcUrl, net.chainId);
    address ??= viemClient.account.address;

    const evmSigner = toFacilitatorEvmSigner({
      address: viemClient.account.address,
      readContract: (args) => viemClient.readContract(args),
      verifyTypedData: (args) => viemClient.verifyTypedData(args as any),
      writeContract: (args) => viemClient.writeContract(args),
      sendTransaction: (args) => viemClient.sendTransaction(args),
      waitForTransactionReceipt: (args) =>
        viemClient.waitForTransactionReceipt(args),
      getCode: (args) => viemClient.getCode(args),
    });

    const network = networkId(net.chainId);
    for (const [, factory] of schemeFactories) {
      facilitator.register(network, factory(evmSigner));
    }
    registeredNetworks.push({ network, chainId: net.chainId });
  }

  if (!address) {
    throw new Error("At least one network must be configured");
  }

  const facilitatorAddress: `0x${string}` = address;
  Object.freeze(registeredNetworks);

  const app = express();
  app.use(express.json());

  // Permissive CORS for local development
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  app.options("*", (_req, res) => {
    res.sendStatus(204);
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      verboseLog1(
        `[facilitator] ${req.method} ${req.path} ${res.statusCode} (${Date.now() - start}ms)`,
      );
    });
    next();
  });

  app.post("/verify", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      if (!paymentPayload || !paymentRequirements) {
        res
          .status(400)
          .json({ error: "Missing paymentPayload or paymentRequirements" });
        return;
      }

      const response = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );
      res.json(response);
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      if (!paymentPayload || !paymentRequirements) {
        res
          .status(400)
          .json({ error: "Missing paymentPayload or paymentRequirements" });
        return;
      }

      const response = await facilitator.settle(
        paymentPayload,
        paymentRequirements,
      );
      res.json(response);
    } catch (error) {
      console.error("Settle error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/supported", (_req, res) => {
    try {
      const response = facilitator.getSupported();
      res.json(response);
    } catch (error) {
      console.error("Supported error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      networks: registeredNetworks.map((n) => n.network),
      facilitator: facilitatorAddress,
    });
  });

  return new Promise<FacilitatorResult>((resolve, reject) => {
    const server = app.listen(options.port, () => {
      resolve({ server, address: facilitatorAddress, networks: registeredNetworks });
    });
    server.on("error", reject);
  });
}
