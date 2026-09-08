import { writeFileSync } from "node:fs";

import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";

const schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema as unknown as {
  parse(value: unknown): unknown;
};
const originalParse = schema.parse.bind(schema);
schema.parse = (value: unknown) => {
  const parsed = originalParse(value) as Record<string, unknown>;
  if (
    parsed.recordType ===
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate"
  ) {
    writeFileSync(
      "/tmp/step15-formal-plan.json",
      `${JSON.stringify(parsed)}\n`,
      { mode: 0o600 },
    );
  }
  return parsed;
};
