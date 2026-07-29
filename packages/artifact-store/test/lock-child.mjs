import { acquireStoreLock } from "../dist/lock.js";

const [, , canonicalRoot, lockPath] = process.argv;
if (canonicalRoot === undefined || lockPath === undefined) {
  process.exitCode = 2;
} else {
  const lease = await acquireStoreLock(canonicalRoot, lockPath, {
    timeoutMs: 1_000,
  });
  process.stdout.write("READY\n");
  process.stdin.setEncoding("utf8");
  process.stdin.once("data", async () => {
    await lease.release();
    process.stdout.write("RELEASED\n");
    process.exit(0);
  });
}
