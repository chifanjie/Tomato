import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { ViewFileSummary } from "../viewgraph/types";
import type { LayerFileGraphNodeData } from "../viewgraph/layerFileGraphModel";

export type LayerFileGraphFlowNode = Node<LayerFileGraphNodeData, "layer-file">;

function complexityClass(complexity: ViewFileSummary["node"]["complexity"]): string {
  if (complexity === "complex") return "border-complexity-complex/65";
  if (complexity === "moderate") return "border-accent-dim/55";
  return "border-node-file/55";
}

function LayerFileGraphNode({ data }: NodeProps<LayerFileGraphFlowNode>) {
  const { file, isSelected, isDimmed, searchMatchCount } = data;

  return (
    <div
      className={`relative w-[220px] rounded-lg border bg-elevated px-3 py-3 text-left shadow-sm transition-[opacity,box-shadow,border-color] ${
        complexityClass(file.node.complexity)
      } ${isSelected ? "ring-2 ring-accent-bright node-glow" : ""} ${
        isDimmed ? "opacity-25" : "opacity-100"
      }`}
    >
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-accent !bg-root"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-accent !bg-root"
      />
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-accent-dim !bg-root"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border !border-accent-dim !bg-root"
      />

      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary" title={file.filePath}>
            {file.name}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-text-muted" title={file.filePath}>
            {file.filePath}
          </div>
        </div>
        {searchMatchCount > 0 && (
          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {searchMatchCount}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-text-secondary">
        <span>
          <b className="text-text-primary">{file.functionCount}</b> fn
        </span>
        <span>
          <b className="text-text-primary">{file.classCount}</b> cls
        </span>
        <span>
          <b className="text-text-primary">{file.importInCount + file.importOutCount}</b> deps
        </span>
      </div>
    </div>
  );
}

export default memo(LayerFileGraphNode);
