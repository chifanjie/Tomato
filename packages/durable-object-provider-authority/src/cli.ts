#!/usr/bin/env node

import { inspectProviderAcceptanceAuthorityCandidateV1 } from "./index.js";

const argumentsV1 = process.argv.slice(2);

if (argumentsV1.length !== 1 || argumentsV1[0] !== "doctor") {
  process.stdout.write(`${JSON.stringify({
    status: "invalid_arguments",
    authority: "installation_owner_candidate",
    strongWrites: "locked",
  })}\n`);
  process.exitCode = 2;
} else {
  const result = await inspectProviderAcceptanceAuthorityCandidateV1();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "ready" ? 0 : 1;
}
