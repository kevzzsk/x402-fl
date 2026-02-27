#!/usr/bin/env node

import { readFileSync } from "fs";
import { Command } from "commander";
import { register as registerDev } from "./commands/dev.js";
import { register as registerFund } from "./commands/fund.js";
import { register as registerBalance } from "./commands/balance.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

const program = new Command();

program
  .name("x402-fl")
  .description(
    "Local x402 facilitator dev tool\n\n" +
      "  Spin up a local Anvil fork and x402 facilitator server for development.\n" +
      "  Requires `anvil` (from Foundry) to be installed and available in PATH.\n\n" +
      "  Quick start:\n" +
      "    $ x402-fl dev\n" +
      "    $ x402-fl fund 0xYourAddress 100",
  )
  .version(pkg.version)
  .showHelpAfterError(true)
  .configureHelp({ showGlobalOptions: true });

registerDev(program);
registerFund(program);
registerBalance(program);

program.parse();
