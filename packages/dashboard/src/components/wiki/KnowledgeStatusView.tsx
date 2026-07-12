import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";

const MAIN_LABEL = {
  ready: "可以阅读",
  degraded: "可以阅读，部分内容待完善",
  blocked: "暂不可用",
} as const;

const REFERENCE_LABEL = {
  complete: "参考覆盖完整",
  partial: "参考覆盖不完整",
} as const;

export interface KnowledgeStatusViewProps {
  index: WikiRuntimeIndex;
  orphanReferencePageIds: readonly string[];
}

export default function KnowledgeStatusView({
  index,
  orphanReferencePageIds,
}: KnowledgeStatusViewProps) {
  const main = index.payload?.mainReadiness;
  const reference = index.payload?.referenceCoverage;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-8 py-10 max-md:px-5">
      <h1 className="text-2xl font-semibold text-text-primary">知识库状态</h1>

      <section className="uc-panel mt-6 p-5">
        <h2 className="text-base font-semibold text-text-primary">主干知识</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {main ? MAIN_LABEL[main.status] : "状态不可用"}
        </p>
        {main?.reasons.map((reason) => (
          <p key={reason} className="mt-2 text-sm leading-6 text-text-muted">{reason}</p>
        ))}
      </section>

      <section className="uc-panel mt-4 p-5">
        <h2 className="text-base font-semibold text-text-primary">全量代码参考</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {reference ? REFERENCE_LABEL[reference.status] : "状态不可用"}
        </p>
        <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-3">
          <p>文件 {reference?.files.covered ?? 0}/{reference?.files.total ?? 0}</p>
          <p>函数 {reference?.functions.covered ?? 0}/{reference?.functions.total ?? 0}</p>
          <p>类型 {reference?.types.covered ?? 0}/{reference?.types.total ?? 0}</p>
        </div>
        {orphanReferencePageIds.length > 0 && (
          <p className="mt-4 text-sm leading-6 text-text-muted">
            有 {orphanReferencePageIds.length} 篇文件文档缺少有效文件节点映射。
          </p>
        )}
      </section>
    </main>
  );
}
