import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowDirection } from "../../graphExplorer/selectionPresentation";

export interface FlowingSemanticEdgeData extends Record<string, unknown> {
  stroke: string;
  opacity: number;
  strokeWidth: number;
  animated: boolean;
  inlineDirection: boolean;
  flowDirection: FlowDirection;
  dashedFallback: boolean;
}

type FlowingSemanticEdgeType = Edge<FlowingSemanticEdgeData, "flowing-semantic">;

export function directionIndicator(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  direction: FlowDirection,
): { glyph: "›" | "↔"; angle: number } {
  const base = Math.atan2(targetY - sourceY, targetX - sourceX) * 180 / Math.PI;
  if (direction === "both") return { glyph: "↔", angle: base };
  return { glyph: "›", angle: direction === "reverse" ? base + 180 : base };
}

export default function FlowingSemanticEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
}: EdgeProps<FlowingSemanticEdgeType>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  if (!data) return null;

  const indicator = directionIndicator(sourceX, sourceY, targetX, targetY, data.flowDirection);
  const overlayStyle = {
    stroke: data.stroke,
    strokeWidth: Math.max(2, data.strokeWidth),
    opacity: data.opacity,
  };

  return (
    <>
      <BaseEdge
        path={path}
        interactionWidth={20}
        style={{
          fill: "none",
          stroke: data.stroke,
          strokeWidth: data.strokeWidth,
          opacity: data.opacity,
          ...(data.dashedFallback ? { strokeDasharray: "6 5" } : {}),
        }}
      />
      {data.animated && (
        <>
          {(data.flowDirection === "forward" || data.flowDirection === "both") && (
            <path
              d={path}
              className="uc-edge-flow-forward"
              pointerEvents="none"
              style={overlayStyle}
            />
          )}
          {(data.flowDirection === "reverse" || data.flowDirection === "both") && (
            <path
              d={path}
              className="uc-edge-flow-reverse"
              pointerEvents="none"
              style={{
                ...overlayStyle,
                ...(data.flowDirection === "both" ? { animationDelay: "-.425s" } : {}),
              }}
            />
          )}
        </>
      )}
      {(data.inlineDirection || label) && (
        <EdgeLabelRenderer>
          {label && (
            <div
              className="uc-semantic-edge-label"
              style={{
                left: labelX,
                top: labelY - 14,
                opacity: data.opacity,
                transform: "translate(-50%, -50%)",
              }}
            >
              {label}
            </div>
          )}
          {data.inlineDirection && (
            <div
              aria-hidden="true"
              className="uc-semantic-edge-direction"
              style={{
                left: labelX,
                top: labelY,
                color: data.stroke,
                opacity: data.opacity,
                transform: `translate(-50%, -50%) rotate(${indicator.angle}deg)`,
              }}
            >
              {indicator.glyph}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
