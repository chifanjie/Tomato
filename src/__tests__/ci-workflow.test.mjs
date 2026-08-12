import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
);
const workflow = readFileSync(workflowPath, "utf8");

function workflowJob(jobName, nextJobName) {
  const startMarker = `  ${jobName}:\n`;
  const start = workflow.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`missing CI job ${jobName}`);
  }
  if (nextJobName === undefined) {
    return workflow.slice(start);
  }
  const end = workflow.indexOf(`  ${nextJobName}:\n`, start + startMarker.length);
  if (end === -1) {
    throw new Error(`missing CI job ${nextJobName}`);
  }
  return workflow.slice(start, end);
}

describe("CI workflow contract", () => {
  it("runs every quality shard and aggregates them fail closed", () => {
    const providerUnit = workflowJob("provider_unit", "provider_distribution");
    const providerDistribution = workflowJob(
      "provider_distribution",
      "workspace_quality",
    );
    const workspaceQuality = workflowJob(
      "workspace_quality",
      "preview_candidate",
    );
    const previewCandidate = workflowJob("preview_candidate", "quality");
    const quality = workflowJob("quality");

    expect(workflow.match(/run: pnpm install --frozen-lockfile/g)).toHaveLength(
      4,
    );

    expect(providerUnit).toContain("pnpm run build");
    expect(providerUnit).toContain("pnpm run typecheck");
    expect(providerUnit).toContain("pnpm exec vitest run --maxWorkers=1");

    expect(providerDistribution).toContain("needs: provider_unit");
    expect(providerDistribution).toContain("pnpm run build");
    expect(providerDistribution).toContain("pnpm run test:distribution");

    expect(workspaceQuality).toContain("pnpm run build:all");
    expect(workspaceQuality).toContain("pnpm run typecheck");
    expect(workspaceQuality).toContain("pnpm run test:skill");
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/contracts --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/repository-state --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/artifact-store --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/core --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/task-engine --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/cli --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/dashboard --fail-if-no-match test",
    );
    expect(workspaceQuality).toContain(
      "pnpm --filter @understand-code/preview --fail-if-no-match test:runtime",
    );
    expect(workspaceQuality).toContain(
      "run: pnpm --filter @understand-code/dashboard audit:surface",
    );
    expect(
      workspaceQuality.indexOf(
        "pnpm --filter @understand-code/dashboard --fail-if-no-match test",
      ),
    ).toBeLessThan(
      workspaceQuality.indexOf(
        "run: pnpm --filter @understand-code/dashboard audit:surface",
      ),
    );

    expect(previewCandidate).toContain("needs: workspace_quality");
    expect(previewCandidate).toContain(
      "pnpm --filter @understand-code/preview --fail-if-no-match build",
    );
    expect(previewCandidate).toContain(
      "pnpm --filter @understand-code/preview --fail-if-no-match typecheck",
    );
    expect(previewCandidate).toContain(
      "pnpm --filter @understand-code/preview --fail-if-no-match test:runtime",
    );
    expect(previewCandidate).toContain(
      "npm pack . --ignore-scripts --pack-destination",
    );
    expect(previewCandidate.match(/npm pack/g)).toHaveLength(1);
    expect(previewCandidate).toContain(
      'test "${#PREVIEW_TARBALLS[@]}" -eq 1',
    );
    expect(previewCandidate).toContain(
      'PREVIEW_TARBALL="${PREVIEW_TARBALLS[0]}"',
    );
    expect(previewCandidate).toContain(
      'UNDERSTAND_CODE_PREVIEW_TARBALL="$PREVIEW_TARBALL"',
    );
    expect(previewCandidate).toContain(
      'sha256sum "$(basename "$PREVIEW_TARBALL")"',
    );
    expect(previewCandidate).toContain(
      "sha256sum --check understand-code-preview.sha256",
    );
    expect(previewCandidate).toContain(
      "UNDERSTAND_CODE_PREVIEW_TARBALL=",
    );
    expect(previewCandidate).toContain(
      "pnpm --filter @understand-code/preview --fail-if-no-match test:cold",
    );
    expect(previewCandidate).toContain("uses: actions/upload-artifact@v6");
    expect(previewCandidate).toContain(
      "name: understand-code-preview-${{ github.sha }}",
    );
    expect(previewCandidate).toContain(
      "preview-artifacts/understand-code-preview-0.1.0-preview.1.tgz",
    );
    expect(previewCandidate).toContain(
      "preview-artifacts/understand-code-preview.sha256",
    );
    expect(
      previewCandidate.indexOf("--fail-if-no-match build"),
    ).toBeLessThan(previewCandidate.indexOf("npm pack . --ignore-scripts"));
    expect(
      previewCandidate.indexOf("npm pack . --ignore-scripts"),
    ).toBeLessThan(
      previewCandidate.indexOf('UNDERSTAND_CODE_PREVIEW_TARBALL="$PREVIEW_TARBALL"'),
    );
    expect(
      previewCandidate.indexOf('UNDERSTAND_CODE_PREVIEW_TARBALL="$PREVIEW_TARBALL"'),
    ).toBeLessThan(previewCandidate.indexOf("sha256sum --check"));

    expect(quality).toContain("if: ${{ always() }}");
    expect(quality).toContain("- provider_unit");
    expect(quality).toContain("- provider_distribution");
    expect(quality).toContain("- workspace_quality");
    expect(quality).toContain("- preview_candidate");
    expect(quality).toContain(
      "PROVIDER_UNIT_RESULT: ${{ needs.provider_unit.result }}",
    );
    expect(quality).toContain(
      "PROVIDER_DISTRIBUTION_RESULT: ${{ needs.provider_distribution.result }}",
    );
    expect(quality).toContain(
      "WORKSPACE_QUALITY_RESULT: ${{ needs.workspace_quality.result }}",
    );
    expect(quality).toContain(
      "PREVIEW_CANDIDATE_RESULT: ${{ needs.preview_candidate.result }}",
    );
    expect(quality).toContain('test "$PROVIDER_UNIT_RESULT" = "success"');
    expect(quality).toContain(
      'test "$PROVIDER_DISTRIBUTION_RESULT" = "success"',
    );
    expect(quality).toContain('test "$WORKSPACE_QUALITY_RESULT" = "success"');
    expect(quality).toContain('test "$PREVIEW_CANDIDATE_RESULT" = "success"');
  });

  it("uses the Node 24-compatible action generation with a pinned project toolchain", () => {
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("uses: pnpm/action-setup@v6");
    expect(workflow).toContain("node-version: 22.x");
    expect(workflow).toMatch(/version:\s*9\b/);
    expect(workflow).toContain("cache-dependency-path: pnpm-lock.yaml");
    expect(workflow).not.toMatch(/uses:\s*\S+@v[1-5]\b/);
  });

  it("keeps the workflow read-only, bounded, and cancellation-aware", () => {
    expect(workflow).toMatch(/permissions:\n\s+contents:\s+read/);
    expect(workflow).not.toMatch(/contents:\s+write|write-all/);
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(
      [...workflow.matchAll(/timeout-minutes:\s*(\d+)/g)].map((match) =>
        Number(match[1]),
      ),
    ).toEqual([45, 45, 45, 20, 5]);
    expect(workflow).toMatch(/on:\n\s+push:\n\s+pull_request:/);
  });
});
