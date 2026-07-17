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
  showLabel: boolean;
  labelOpacity: number;
  sourceLabel: string;
  targetLabel: string;
}

type FlowingSemanticEdgeType = Edge<FlowingSemanticEdgeData, "flowing-semantic">;

function clampEndpointLabel(label: string): string {
  const characters = Array.from(label);
  return characters.length > 10 ? `${characters.slice(0, 10).join("")}…` : label;
}

export function edgeDirectionCopy(
  sourceLabel: string,
  targetLabel: string,
  direction: FlowDirection,
): { visible: string; ariaLabel: string } {
  const fullSource = direction === "reverse" ? targetLabel : sourceLabel;
  const fullTarget = direction === "reverse" ? sourceLabel : targetLabel;
  const visibleSource = clampEndpointLabel(fullSource);
  const visibleTarget = clampEndpointLabel(fullTarget);
  if (direction === "both") {
    return {
      visible: `「${clampEndpointLabel(sourceLabel)}」与「${clampEndpointLabel(targetLabel)}」双向`,
      ariaLabel: `「${sourceLabel}」与「${targetLabel}」双向`,
    };
  }
  return {
    visible: `从「${visibleSource}」到「${visibleTarget}」`,
    ariaLabel: `从「${fullSource}」到「${fullTarget}」`,
  };
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

  const directionCopy = edgeDirectionCopy(
    data.sourceLabel,
    data.targetLabel,
    data.flowDirection,
  );
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
      {(data.inlineDirection || (data.showLabel && label)) && (
        <EdgeLabelRenderer>
          {data.showLabel && label && (
            <div
              className="uc-semantic-edge-label"
              style={{
                left: labelX,
                top: labelY - 14,
                opacity: data.labelOpacity,
                transform: "translate(-50%, -50%)",
              }}
            >
              {label}
            </div>
          )}
          {data.inlineDirection && (
            <div
              role="img"
              aria-label={directionCopy.ariaLabel}
              className="uc-semantic-edge-direction"
              style={{
                left: labelX,
                top: labelY + 12,
                opacity: data.labelOpacity,
                transform: "translate(-50%, -50%)",
              }}
            >
              {directionCopy.visible}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
