let verbosity = 0;

export function setVerbosity(level: number): void {
  verbosity = level;
}

export function verboseLog1(...args: unknown[]): void {
  if (verbosity >= 1) console.log(...args);
}

export function verboseLog2(...args: unknown[]): void {
  if (verbosity >= 2) console.log(...args);
}
