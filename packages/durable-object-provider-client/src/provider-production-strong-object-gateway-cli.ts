#!/usr/bin/env node

import { startProviderProductionStrongObjectGatewayServiceV1 } from "./provider-production-strong-object-gateway.js";

async function mainV1(argv: readonly string[]): Promise<void> {
  if (
    argv.length !== 2 || argv[0] !== "--installation-root" ||
    argv[1] === undefined || argv[1].length === 0
  ) {
    throw new TypeError(
      "usage: understand-code-provider-strong-object-gateway --installation-root <absolute-path>",
    );
  }
  const service = await startProviderProductionStrongObjectGatewayServiceV1({
    canonicalInstallationRoot: argv[1],
  });
  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    void service.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

void mainV1(process.argv.slice(2)).catch(() => {
  process.stderr.write("provider strong object gateway unavailable\n");
  process.exitCode = 1;
});
