import type { FileCallEdge } from "../viewgraph/callRelationships";
import { getFocusedFileCallEdges } from "../viewgraph/callRelationships";

export interface FileCardAnchor {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerCallPath {
  id: string;
  edge: FileCallEdge;
  d: string;
  labelX: number;
  labelY: number;
  strokeWidth: number;
}

interface BuildLayerCallPathsOptions {
  edges: FileCallEdge[];
  anchors: Map<string, FileCardAnchor>;
  focusedFileId: string | null;
}

interface LayerCallOverlayProps extends BuildLayerCallPathsOptions {
  visible?: boolean;
}

const CALL_STROKE = "rgba(212,165,116,0.8)";
const IMPORT_STROKE = "rgba(212,165,116,0.55)";
const LABEL_STROKE = "rgba(13,17,20,0.72)";
const LABEL_FILL = "#d4a574";

function center(anchor: FileCardAnchor): { x: number; y: number } {
  return {
    x: anchor.x + anchor.width / 2,
    y: anchor.y + anchor.height / 2,
  };
}

function edgeEndpoint(
  anchor: FileCardAnchor,
  other: FileCardAnchor,
  isSource: boolean,
): { x: number; y: number } {
  const ownCenter = center(anchor);
  const otherCenter = center(other);
  const dx = otherCenter.x - ownCenter.x;
  const dy = otherCenter.y - ownCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1;
    return {
      x: ownCenter.x + (isSource ? direction : -direction) * (anchor.width / 2),
      y: ownCenter.y,
    };
  }

  const direction = dy >= 0 ? 1 : -1;
  return {
    x: ownCenter.x,
    y: ownCenter.y + (isSource ? direction : -direction) * (anchor.height / 2),
  };
}

function strokeWidthFor(edge: FileCallEdge): number {
  if (edge.count <= 1) return 1.5;
  return Math.min(1 + Math.log2(edge.count + 1), 5);
}

function stableCurveOffset(edge: FileCallEdge): number {
  const pairKey = `${edge.sourceFileId}|${edge.targetFileId}`;
  let sum = 0;
  for (let index = 0; index < pairKey.length; index += 1) {
    sum += pairKey.charCodeAt(index);
  }
  return sum % 2 === 0 ? 22 : -22;
}

export function buildLayerCallPaths({
  edges,
  anchors,
  focusedFileId,
}: BuildLayerCallPathsOptions): LayerCallPath[] {
  return getFocusedFileCallEdges(edges, focusedFileId).flatMap((edge) => {
    const source = anchors.get(edge.sourceFileId);
    const target = anchors.get(edge.targetFileId);
    if (!source || !target) return [];

    const start = edgeEndpoint(source, target, true);
    const end = edgeEndpoint(target, source, false);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sign = horizontal ? (dx >= 0 ? 1 : -1) : (dy >= 0 ? 1 : -1);
    const controlDistance = Math.max(56, Math.min(180, (horizontal ? Math.abs(dx) : Math.abs(dy)) * 0.45));
    const offset = Math.abs(horizontal ? dy : dx) < 44 ? stableCurveOffset(edge) : 0;
    const c1 = horizontal
      ? { x: start.x + sign * controlDistance, y: start.y + offset }
      : { x: start.x + offset, y: start.y + sign * controlDistance };
    const c2 = horizontal
      ? { x: end.x - sign * controlDistance, y: end.y + offset }
      : { x: end.x + offset, y: end.y - sign * controlDistance };

    return [{
      id: `${edge.source}:${edge.sourceFileId}->${edge.targetFileId}`,
      edge,
      d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
      labelX: (start.x + end.x) / 2 + (horizontal ? 0 : offset * 0.5),
      labelY: (start.y + end.y) / 2 + (horizontal ? offset * 0.5 : 0),
      strokeWidth: strokeWidthFor(edge),
    }];
  });
}

export default function LayerCallOverlay({
  edges,
  anchors,
  focusedFileId,
  visible = true,
}: LayerCallOverlayProps) {
  if (!visible || !focusedFileId) return null;

  const paths = buildLayerCallPaths({ edges, anchors, focusedFileId });
  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="layer-call-arrowhead"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={CALL_STROKE} />
        </marker>
        <marker
          id="layer-import-arrowhead"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={IMPORT_STROKE} />
        </marker>
      </defs>

      {paths.map((path) => {
        const isImport = path.edge.source === "imports";
        return (
          <g key={path.id}>
            <path
              d={path.d}
              fill="none"
              stroke={isImport ? IMPORT_STROKE : CALL_STROKE}
              strokeWidth={path.strokeWidth}
              strokeLinecap="round"
              strokeDasharray={isImport ? "4 4" : undefined}
              markerEnd={`url(#${isImport ? "layer-import-arrowhead" : "layer-call-arrowhead"})`}
              opacity={isImport ? 0.78 : 0.92}
            />
            <text
              x={path.labelX}
              y={path.labelY - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={LABEL_FILL}
              stroke={LABEL_STROKE}
              strokeWidth={3}
              paintOrder="stroke fill"
              fontSize={11}
              fontWeight={600}
            >
              {path.edge.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
