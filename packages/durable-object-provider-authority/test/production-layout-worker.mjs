import {
  resolveProviderAcceptanceAuthorityProductionLayoutInternalV1,
} from "../dist/platform-layout.js";

const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
process.stdout.write(`${JSON.stringify(layout)}\n`);
