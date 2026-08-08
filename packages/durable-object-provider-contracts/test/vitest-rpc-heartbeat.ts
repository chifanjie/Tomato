import { setImmediate as scheduleImmediate } from "node:timers";

import { beforeEach } from "vitest";

// Vitest intentionally sends task updates without awaiting their RPC ACK. Give
// the worker one poll turn before a CPU-bound test so the previous update cannot
// expire behind that test's synchronous work on slower CI hosts.
beforeEach(async () => {
  await new Promise<void>((resolveHeartbeat) => {
    scheduleImmediate(resolveHeartbeat);
  });
});
