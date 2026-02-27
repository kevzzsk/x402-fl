import { InvalidArgumentError } from "commander";

export function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError("must be a number between 1 and 65535");
  }
  return port;
}

export function parseAddress(value: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new InvalidArgumentError(
      "must be a valid 0x-prefixed Ethereum address (42 characters)",
    );
  }
  return value as `0x${string}`;
}

export function parseAmount(value: string): string {
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
    throw new InvalidArgumentError(
      "must be a positive number (e.g. '100' or '1.5')",
    );
  }
  return value;
}
