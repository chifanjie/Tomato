import type { FunctionDot, FunctionGroup, ViewFileSummary } from "../viewgraph/types";
import { useI18n } from "../contexts/I18nContext";

const GROUP_COLORS: Record<FunctionDot["group"], string> = {
  entry: "bg-accent",
  filter: "bg-[#7cc7a1]",
  data: "bg-[#7aa7d9]",
  model: "bg-[#c7a76f]",
  other: "bg-text-muted",
};

interface FunctionMatrixPanelProps {
  file: ViewFileSummary;
  selectedFunctionId: string | null;
  onSelectFunction: (functionId: string) => void;
}

function formatLineRange(dot: FunctionDot): string {
  return dot.lineRange ? `L${dot.lineRange[0]}-${dot.lineRange[1]}` : "";
}

function DotButton({
  dot,
  isSelected,
  onSelectFunction,
}: {
  dot: FunctionDot;
  isSelected: boolean;
  onSelectFunction: (functionId: string) => void;
}) {
  const lineRange = formatLineRange(dot);
  const opacity = dot.impactScore > 0 ? "opacity-100" : "opacity-80";

  return (
    <button
      type="button"
      title={[dot.name, lineRange].filter(Boolean).join(" ")}
      aria-label={dot.name}
      onClick={() => onSelectFunction(dot.nodeId)}
      className={`block transition-[outline,opacity,transform] hover:opacity-100 hover:scale-125 ${opacity} ${GROUP_COLORS[dot.group]} ${
        isSelected ? "outline outline-2 outline-accent-bright outline-offset-2 opacity-100" : "outline outline-1 outline-transparent"
      }`}
      style={{ width: 10, height: 10, borderRadius: 9999 }}
    />
  );
}

function GroupSection({
  group,
  selectedFunctionId,
  onSelectFunction,
}: {
  group: FunctionGroup;
  selectedFunctionId: string | null;
  onSelectFunction: (functionId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary truncate">
          {group.label}
        </h3>
        <span className="text-[10px] font-mono text-text-muted shrink-0">{group.count}</span>
      </div>
      <div
        className="grid gap-1.5 content-start"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(10px, 10px))" }}
      >
        {group.dots.map((dot) => (
          <DotButton
            key={dot.nodeId}
            dot={dot}
            isSelected={dot.nodeId === selectedFunctionId}
            onSelectFunction={onSelectFunction}
          />
        ))}
      </div>
    </section>
  );
}

export default function FunctionMatrixPanel({
  file,
  selectedFunctionId,
  onSelectFunction,
}: FunctionMatrixPanelProps) {
  const { t } = useI18n();

  return (
    <div className="h-full min-h-0 overflow-auto px-5 py-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg text-text-primary truncate" title={file.filePath}>
            {file.name}
          </h2>
          <p className="mt-1 text-xs font-mono text-text-muted truncate" title={file.filePath}>
            {file.filePath}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-heading text-accent">{file.functionCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">{t.functionDetail.functions}</div>
        </div>
      </div>
      <div className="space-y-6">
        {file.functionGroups.map((group) => (
          <GroupSection
            key={group.kind}
            group={group}
            selectedFunctionId={selectedFunctionId}
            onSelectFunction={onSelectFunction}
          />
        ))}
      </div>
    </div>
  );
}
