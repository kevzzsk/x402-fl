import net from "net";

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Resolve a port number, checking if it's in use and finding an available one if necessary.
 * @param port The initial port number to check.
 * @param explicit Whether the port was explicitly specified by the user.
 * @param label A label for the port (used in error/warning messages).
 * @returns A promise that resolves to an available port number.
 */
export async function resolvePort(
  port: number,
  explicit: boolean,
  label: string,
): Promise<number> {
  if (!(await isPortInUse(port))) return port;

  if (explicit) {
    throw new Error(`${label} port ${port} is already in use`);
  }

  let candidate = port + 1;
  while (candidate <= 65535) {
    if (!(await isPortInUse(candidate))) {
      console.warn(`${label} port ${port} in use, using ${candidate}`);
      return candidate;
    }
    candidate++;
  }

  throw new Error(`No free port found starting from ${port} for ${label}`);
}
