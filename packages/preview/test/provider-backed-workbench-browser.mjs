import assert from "node:assert/strict";

import {
  launchBrowser,
  resolveBrowserExecutable,
} from "./browser-harness.mjs";

const TASK_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/u;

function taskProjectionPath(taskId, kind, section) {
  const path = `/tasks/${encodeURIComponent(taskId)}/${kind}.json`;
  return section === undefined
    ? path
    : `${path}?section=${encodeURIComponent(section)}`;
}

function isRepositoryRelativePath(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.includes("\\") &&
    !value.split("/").some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    );
}

/**
 * Exercises the installed React Workbench through a launch URL minted by the
 * production Provider-bound MCP runtime. The caller must keep that MCP process
 * alive until this function returns because it owns the loopback session.
 */
export async function assertProviderBackedPackedWorkbenchBrowserV1({
  deepLink,
  taskId,
  findingId,
  evidenceId,
  actualSnapshotId,
  taskRevision,
  userDataDir,
  forbiddenPaths,
}) {
  assert.match(taskId, TASK_ID_PATTERN, "Provider-backed Browser Task ID");
  assert.equal(typeof findingId === "string" && findingId.length > 0, true);
  assert.equal(typeof evidenceId === "string" && evidenceId.length > 0, true);
  assert.equal(typeof actualSnapshotId === "string" && actualSnapshotId.length > 0, true);
  assert.equal(Number.isSafeInteger(taskRevision) && taskRevision >= 0, true);
  assert.equal(
    Array.isArray(forbiddenPaths) &&
      forbiddenPaths.length > 0 &&
      forbiddenPaths.every((candidate) =>
        typeof candidate === "string" && candidate.length > 0
      ),
    true,
    "Provider-backed Browser E2E requires private path canaries",
  );
  const launchUrl = new URL(deepLink);
  assert.equal(
    launchUrl.hostname,
    "127.0.0.1",
    "Provider-backed Workbench must bind loopback only",
  );
  assert.equal(launchUrl.pathname, "/workbench");
  assert.equal(launchUrl.searchParams.get("view"), "tasks");
  assert.equal(launchUrl.searchParams.get("taskId"), taskId);
  assert.equal(launchUrl.searchParams.get("section"), "planned_changes");
  assert.equal(launchUrl.searchParams.get("findingId"), findingId);
  assert.equal(launchUrl.searchParams.get("evidenceId"), null);
  assert.notEqual(launchUrl.hash, "", "Workbench launch URL must carry a one-time token");
  let launchToken = launchUrl.hash.slice(1);

  const executable = await resolveBrowserExecutable();
  assert.notEqual(
    executable,
    null,
    "Provider-backed packaged Browser E2E requires Chrome or Chromium",
  );

  const browser = await launchBrowser({
    executable,
    userDataDir,
    timeoutMs: 30_000,
  });
  try {
    await browser.navigate(deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]')?.getAttribute('data-state') === 'ready'",
      "Provider-backed packed Task Workbench ready state",
      30_000,
    );
    await browser.waitFor(
      `document.querySelector('[data-testid="task-finding-open"][data-finding-id=${JSON.stringify(findingId)}]')?.getAttribute('aria-current') === 'true'`,
      "Provider-backed packed Finding selected state",
      30_000,
    );
    await browser.click(
      `[data-testid="task-evidence-open"][data-evidence-id=${JSON.stringify(evidenceId)}]`,
    );
    await browser.waitFor(
      `new URLSearchParams(location.search).get('evidenceId') === ${JSON.stringify(evidenceId)}
        && document.querySelector('[data-testid="task-evidence-view"][data-evidence-id=${JSON.stringify(evidenceId)}]')?.getAttribute('data-state') === 'ready'`,
      "Provider-backed packed Evidence and Source ready state",
      30_000,
    );

    const routes = {
      brief: taskProjectionPath(taskId, "brief", "planned_changes"),
      changeCheck: taskProjectionPath(taskId, "change-check"),
      verification: taskProjectionPath(taskId, "verification"),
      evidence: `/__workbench/evidence?${new URLSearchParams({ taskId, evidenceId })}`,
      graph: "/knowledge-graph.json",
      meta: "/meta.json",
      wiki: "/knowledge-base/wiki-index.json",
    };
    const projections = await browser.evaluate(`Promise.all(
      ${JSON.stringify(Object.entries(routes))}.map(async ([name, route]) => {
        const response = await fetch(route, {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        });
        return [name, { statusCode: response.status, payload: await response.json() }];
      }),
    ).then(Object.fromEntries)`);

    assert.equal(projections.brief.statusCode, 200);
    assert.equal(projections.brief.payload.task.taskId, taskId);
    assert.equal(projections.brief.payload.task.taskProfile, "agent_task_v1");
    assert.equal(projections.brief.payload.task.status, "verified");
    assert.equal(projections.brief.payload.task.revision, taskRevision);
    assert.equal(projections.brief.payload.task.latestSnapshotId, actualSnapshotId);
    assert.equal(projections.brief.payload.section, "planned_changes");
    assert.equal(projections.brief.payload.freshness.current, true);
    assert.equal(
      projections.brief.payload.freshness.sourceSnapshotId,
      actualSnapshotId,
    );
    assert.equal(
      typeof projections.brief.payload.brief.originalIntent,
      "string",
    );

    assert.equal(projections.changeCheck.statusCode, 200);
    assert.equal(projections.changeCheck.payload.task.taskId, taskId);
    assert.equal(projections.changeCheck.payload.task.revision, taskRevision);
    assert.equal(
      projections.changeCheck.payload.artifact.artifactType,
      "change_check",
    );
    assert.equal(projections.changeCheck.payload.artifact.payload.taskId, taskId);
    assert.equal(
      projections.changeCheck.payload.artifact.payload.actualSnapshotId,
      actualSnapshotId,
    );
    assert.equal(
      projections.changeCheck.payload.artifact.sourceSnapshotId,
      actualSnapshotId,
    );
    assert.equal(projections.changeCheck.payload.freshness.current, true);
    assert.equal(
      projections.changeCheck.payload.freshness.sourceSnapshotId,
      actualSnapshotId,
    );

    assert.equal(projections.verification.statusCode, 200);
    assert.equal(projections.verification.payload.task.taskId, taskId);
    assert.equal(projections.verification.payload.task.revision, taskRevision);
    assert.equal(
      projections.verification.payload.artifact.artifactType,
      "verification",
    );
    assert.equal(
      projections.verification.payload.artifact.payload.profile,
      "verification_ledger_strong_v1",
    );
    assert.equal(
      projections.verification.payload.artifact.sourceSnapshotId,
      actualSnapshotId,
    );
    assert.equal(
      projections.verification.payload.artifact.payload.records.length > 0,
      true,
    );
    assert.equal(
      projections.verification.payload.artifact.payload.records.every(
        (record) => record.snapshotId === actualSnapshotId,
      ),
      true,
    );
    assert.equal(projections.verification.payload.freshness.current, true);
    assert.equal(
      projections.verification.payload.freshness.sourceSnapshotId,
      actualSnapshotId,
    );

    assert.equal(projections.evidence.statusCode, 200);
    assert.equal(projections.evidence.payload.status, "ready");
    assert.equal(projections.evidence.payload.taskId, taskId);
    assert.equal(projections.evidence.payload.evidenceId, evidenceId);
    assert.equal(projections.evidence.payload.snapshotId, actualSnapshotId);
    assert.equal(
      projections.evidence.payload.evidence.observedAtSnapshotId,
      actualSnapshotId,
    );
    assert.equal(
      projections.evidence.payload.evidence.filePath,
      projections.evidence.payload.source.filePath,
    );
    assert.equal(
      isRepositoryRelativePath(projections.evidence.payload.source.filePath),
      true,
      "Provider-backed Source path must remain repository-relative",
    );
    assert.equal(projections.evidence.payload.source.filePath, "src/task.ts");
    assert.match(
      projections.evidence.payload.source.content,
      /return input \+ 2;/u,
    );

    assert.equal(projections.graph.statusCode, 200);
    assert.equal(projections.meta.statusCode, 200);
    assert.equal(
      projections.meta.payload.gitCommitHash,
      projections.graph.payload.project.gitCommitHash,
    );
    assert.equal(
      Number.isSafeInteger(projections.meta.payload.analyzedFiles) &&
        projections.meta.payload.analyzedFiles > 0,
      true,
    );
    assert.equal(projections.wiki.statusCode, 200);

    const dom = await browser.evaluate(`(() => {
      const workbench = document.querySelector('[data-testid="task-first-workbench"]');
      return {
        hashCleared: location.hash === '',
        html: document.documentElement.outerHTML,
        state: workbench?.getAttribute('data-state') ?? null,
        text: workbench?.textContent ?? '',
      };
    })()`);
    assert.equal(dom.hashCleared, true, "one-time Workbench launch token must leave the URL");
    assert.equal(dom.state, "ready");
    assert.match(dom.text, /Synthetic Step16 Provider vertical/u);
    assert.doesNotMatch(dom.html, /provider_unavailable/u);
    const publicProjection = JSON.stringify({ projections, dom });
    for (const forbiddenPath of forbiddenPaths) {
      assert.equal(
        publicProjection.includes(forbiddenPath),
        false,
        "Provider-backed Workbench exposed a private absolute path",
      );
    }

    const replayStatus = await browser.evaluate(`fetch('/__workbench/launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: ${JSON.stringify(launchToken)} }),
    }).then((response) => response.status)`);
    launchToken = "";
    assert.equal(replayStatus, 401, "redeemed Workbench launch token must reject replay");

    const waitForTaskContextSurface = async (surface, label) => {
      await browser.waitFor(
        `(() => {
          const overlay = document.querySelector('[data-testid="task-context-overlay"]');
          const selected = [...document.querySelectorAll('nav[aria-label="主要界面"] button')]
            .find((button) => button.textContent?.includes(${JSON.stringify(label)}));
          return overlay?.getAttribute('data-state') === 'ready'
            && overlay.textContent?.includes(${JSON.stringify(taskId)})
            && overlay.textContent?.includes(${JSON.stringify(findingId)})
            && overlay.textContent?.includes(${JSON.stringify(evidenceId)})
            && selected?.getAttribute('aria-current') === 'page'
            && new URLSearchParams(location.search).get('surface') === ${JSON.stringify(surface)}
            && (${JSON.stringify(surface)} === 'wiki'
              ? document.querySelector('[aria-label="知识库目录"]') !== null
              : document.querySelector('.uc-semantic-canvas') !== null);
        })()`,
        `Provider-backed ${label} retained Task Evidence context`,
        30_000,
      );
    };

    await browser.clickText('nav[aria-label="主要界面"] button', "知识库");
    await waitForTaskContextSurface("wiki", "知识库");
    await browser.clickText('nav[aria-label="主要界面"] button', "关系图谱");
    await waitForTaskContextSurface("graph", "关系图谱");
    await browser.clickText('nav[aria-label="主要界面"] button', "任务");
    await browser.waitFor(
      `(() => {
        const route = new URLSearchParams(location.search);
        return document.querySelector('[data-testid="task-first-workbench"]')?.getAttribute('data-state') === 'ready'
          && document.querySelector('[data-testid="task-context-overlay"]') === null
          && route.get('view') === 'tasks'
          && route.get('taskId') === ${JSON.stringify(taskId)}
          && route.get('section') === 'planned_changes'
          && route.get('findingId') === ${JSON.stringify(findingId)}
          && route.get('surface') === null;
      })()`,
      "Provider-backed Graph and Wiki return to Task context",
      30_000,
    );

    const cookies = await browser.getCookies([launchUrl.origin]);
    assert.equal(
      cookies.some((cookie) =>
        cookie.name === "workbench_session" &&
        cookie.domain === "127.0.0.1" &&
        cookie.httpOnly === true &&
        cookie.path === "/" &&
        cookie.session === true &&
        cookie.sameSite === "Strict" &&
        cookie.valueLength > 0),
      true,
      "Provider-backed Workbench must redeem the token into an HttpOnly Strict session",
    );
    for (const route of Object.values(routes)) {
      assert.equal(
        browser.networkResponses.some((response) =>
          new URL(response.url).pathname === new URL(route, launchUrl.origin).pathname &&
          response.status === 200),
        true,
        `Provider-backed Browser did not observe a successful packed route: ${route}`,
      );
    }
    assert.equal(
      browser.networkResponses.some((response) =>
        response.url.includes(`/tasks/${encodeURIComponent(taskId)}/`) &&
        response.status === 503),
      false,
      "Provider-backed packed Task routes must not fall back to provider_unavailable",
    );
    assert.deepEqual(browser.pageErrors, []);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
