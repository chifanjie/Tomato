import type { GraphNode } from "@understand-anything/core/types";
import type { FunctionCallEdge, FunctionCallNeighborhood } from "../viewgraph/callRelationships";

export interface FunctionMiniMapNode {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  kind: "incoming" | "selected" | "outgoing";
  isExternal: boolean;
}

export interface FunctionMiniMapEdge {
  id: string;
  sourceFunctionId: string;
  targetFunctionId: string;
  d: string;
  labelX: number;
  labelY: number;
}

export interface FunctionMiniMapModel {
  width: number;
  height: number;
  nodes: FunctionMiniMapNode[];
  edges: FunctionMiniMapEdge[];
}

interface FunctionCallMiniMapProps {
  neighborhood: FunctionCallNeighborhood;
  nodesById: Map<string, GraphNode>;
}

const WIDTH = 640;
const COLUMN_LEFT = 120;
const COLUMN_CENTER = 320;
const COLUMN_RIGHT = 520;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 46;
const ROW_GAP = 62;
const EDGE_STROKE = "rgba(212,165,116,0.8)";
const LABEL_STROKE = "rgba(13,17,20,0.72)";

function uniqueSortedFunctionIds(ids: string[], nodesById: Map<string, GraphNode>): string[] {
  return [...new Set(ids)].sort((a, b) => {
    const nodeA = nodesById.get(a);
    const nodeB = nodesById.get(b);
    const lineA = nodeA?.lineRange?.[0] ?? Number.MAX_SAFE_INTEGER;
    const lineB = nodeB?.lineRange?.[0] ?? Number.MAX_SAFE_INTEGER;
    if (lineA !== lineB) return lineA - lineB;
    return (nodeA?.name ?? a).localeCompare(nodeB?.name ?? b);
  });
}

function lineLabel(node: GraphNode | undefined): string {
  return node?.lineRange ? `L${node.lineRange[0]}-${node.lineRange[1]}` : "";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function selectedFileIdFor(neighborhood: FunctionCallNeighborhood): string | null {
  for (const edge of [...neighborhood.incoming, ...neighborhood.outgoing]) {
    if (edge.sourceFunctionId === neighborhood.selectedFunctionId) return edge.sourceFileId;
    if (edge.targetFunctionId === neighborhood.selectedFunctionId) return edge.targetFileId;
  }
  return null;
}

function fileIdForFunction(
  functionId: string,
  neighborhood: FunctionCallNeighborhood,
): string | null {
  for (const edge of [...neighborhood.incoming, ...neighborhood.outgoing]) {
    if (edge.sourceFunctionId === functionId) return edge.sourceFileId;
    if (edge.targetFunctionId === functionId) return edge.targetFileId;
  }
  return null;
}

function yPositions(count: number, centerY: number): number[] {
  if (count === 0) return [];
  const total = (count - 1) * ROW_GAP;
  const start = centerY - total / 2;
  return Array.from({ length: count }, (_, index) => start + index * ROW_GAP);
}

function makeNode(
  id: string,
  kind: FunctionMiniMapNode["kind"],
  x: number,
  y: number,
  selectedFileId: string | null,
  neighborhood: FunctionCallNeighborhood,
  nodesById: Map<string, GraphNode>,
): FunctionMiniMapNode {
  const node = nodesById.get(id);
  const fileId = id === neighborhood.selectedFunctionId
    ? selectedFileId
    : fileIdForFunction(id, neighborhood);
  const detail = [node?.filePath, lineLabel(node)].filter(Boolean).join(" ");

  return {
    id,
    label: node?.name ?? id,
    detail,
    x,
    y,
    kind,
    isExternal: Boolean(fileId && selectedFileId && fileId !== selectedFileId),
  };
}

function edgePath(source: FunctionMiniMapNode, target: FunctionMiniMapNode): FunctionMiniMapEdge["d"] {
  const startX = source.x + NODE_WIDTH / 2;
  const startY = source.y;
  const endX = target.x - NODE_WIDTH / 2;
  const endY = target.y;
  const dx = endX - startX;
  const control = Math.max(44, Math.abs(dx) * 0.45);

  return `M ${startX} ${startY} C ${startX + control} ${startY}, ${endX - control} ${endY}, ${endX} ${endY}`;
}

function buildMiniMapEdge(
  edge: FunctionCallEdge,
  nodes: Map<string, FunctionMiniMapNode>,
): FunctionMiniMapEdge | null {
  const source = nodes.get(edge.sourceFunctionId);
  const target = nodes.get(edge.targetFunctionId);
  if (!source || !target) return null;

  return {
    id: `${edge.sourceFunctionId}->${edge.targetFunctionId}`,
    sourceFunctionId: edge.sourceFunctionId,
    targetFunctionId: edge.targetFunctionId,
    d: edgePath(source, target),
    labelX: (source.x + target.x) / 2,
    labelY: (source.y + target.y) / 2 - 8,
  };
}

export function buildFunctionMiniMapModel(
  neighborhood: FunctionCallNeighborhood,
  nodesById: Map<string, GraphNode>,
): FunctionMiniMapModel {
  const incomingIds = uniqueSortedFunctionIds(
    neighborhood.incoming.map((edge) => edge.sourceFunctionId),
    nodesById,
  );
  const outgoingIds = uniqueSortedFunctionIds(
    neighborhood.outgoing.map((edge) => edge.targetFunctionId),
    nodesById,
  );
  const maxRows = Math.max(1, incomingIds.length, outgoingIds.length);
  const height = Math.max(190, maxRows * ROW_GAP + 80);
  const centerY = height / 2;
  const selectedFileId = selectedFileIdFor(neighborhood);
  const incomingY = yPositions(incomingIds.length, centerY);
  const outgoingY = yPositions(outgoingIds.length, centerY);
  const nodes = [
    ...incomingIds.map((id, index) => makeNode(
      id,
      "incoming" as const,
      COLUMN_LEFT,
      incomingY[index],
      selectedFileId,
      neighborhood,
      nodesById,
    )),
    makeNode(
      neighborhood.selectedFunctionId,
      "selected",
      COLUMN_CENTER,
      centerY,
      selectedFileId,
      neighborhood,
      nodesById,
    ),
    ...outgoingIds.map((id, index) => makeNode(
      id,
      "outgoing" as const,
      COLUMN_RIGHT,
      outgoingY[index],
      selectedFileId,
      neighborhood,
      nodesById,
    )),
  ];
  const nodesByFunctionId = new Map(nodes.map((node) => [node.id, node]));
  const edgesById = new Map<string, FunctionMiniMapEdge>();
  for (const edge of [...neighborhood.incoming, ...neighborhood.outgoing]) {
    const miniMapEdge = buildMiniMapEdge(edge, nodesByFunctionId);
    if (miniMapEdge) edgesById.set(miniMapEdge.id, miniMapEdge);
  }

  return {
    width: WIDTH,
    height,
    nodes,
    edges: [...edgesById.values()],
  };
}

export default function FunctionCallMiniMap({
  neighborhood,
  nodesById,
}: FunctionCallMiniMapProps) {
  const model = buildFunctionMiniMapModel(neighborhood, nodesById);

  return (
    <div className="h-full min-h-[220px] overflow-auto border-b border-border-subtle bg-root px-4 py-3">
      <svg
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="h-full min-h-[210px] w-full"
        role="img"
        aria-label="Function call map"
      >
        <defs>
          <marker
            id="function-call-arrowhead"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STROKE} />
          </marker>
        </defs>

        {model.edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.d}
            fill="none"
            stroke={EDGE_STROKE}
            strokeWidth={2.25}
            strokeLinecap="round"
            markerEnd="url(#function-call-arrowhead)"
            opacity={0.92}
          />
        ))}

        {model.nodes.map((node) => {
          const selected = node.kind === "selected";
          return (
            <g key={node.id} transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}>
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={7}
                fill={selected ? "rgba(74,171,154,0.18)" : "rgba(24,33,39,0.92)"}
                stroke={selected ? "rgba(104,196,180,0.75)" : "rgba(212,165,116,0.42)"}
                strokeWidth={selected ? 1.6 : 1}
                strokeDasharray={node.isExternal ? "4 4" : undefined}
              />
              <text
                x={10}
                y={18}
                fill={selected ? "#edf2f2" : "#d4a574"}
                fontSize={12}
                fontWeight={selected ? 700 : 600}
              >
                {truncate(node.label, 18)}
              </text>
              {node.detail && (
                <text x={10} y={34} fill="#a39787" fontSize={9}>
                  {truncate(node.detail, 24)}
                </text>
              )}
            </g>
          );
        })}

        {model.edges.map((edge) => (
          <text
            key={`${edge.id}:label`}
            x={edge.labelX}
            y={edge.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#d4a574"
            stroke={LABEL_STROKE}
            strokeWidth={3}
            paintOrder="stroke fill"
            fontSize={10}
            fontWeight={600}
          >
            calls
          </text>
        ))}
      </svg>
    </div>
  );
}
