import type { KnowledgeBaseProjectConfig } from "../types.js";
import type { RouteStage, WikiDocumentRole } from "./wiki-contract.js";

export interface RoutePageInput {
  id: string;
  role: WikiDocumentRole;
  route?: { order: number; stage: RouteStage };
}

export interface RouteOverrideResult {
  pages: RoutePageInput[];
  warnings: string[];
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function applyRouteOverrides(
  input: readonly RoutePageInput[],
  config: KnowledgeBaseProjectConfig,
): RouteOverrideResult {
  const pages = input.map((page) => ({
    ...page,
    ...(page.route ? { route: { ...page.route } } : {}),
  }));
  const pin = normalizeList(config.route?.pin);
  const hide = normalizeList(config.route?.hide);
  const order = normalizeList(config.route?.order);
  const pageIds = new Set(pages.map((page) => page.id));
  const warnings: string[] = [];

  const configuredIds = [...new Set([...hide, ...pin, ...order])];
  for (const id of configuredIds) {
    if (!pageIds.has(id)) {
      warnings.push(`路由配置引用了不存在的页面 ${id}`);
    }
  }

  const hideIds = new Set(hide);
  const pinIds = new Set(pin);
  for (const id of hide) {
    if (pinIds.has(id)) {
      warnings.push(`页面 ${id} 同时出现在 hide 与 pin 中，已按 hide 处理`);
    }
  }

  for (const page of pages) {
    if (hideIds.has(page.id)) {
      page.role = "reference";
      delete page.route;
    } else if (pinIds.has(page.id)) {
      page.role = "featured";
    }
  }

  const orderRank = new Map(order.map((id, index) => [id, index]));
  const featured = pages
    .filter((page) => page.role === "featured")
    .sort((left, right) => {
      const leftConfiguredOrder = orderRank.get(left.id);
      const rightConfiguredOrder = orderRank.get(right.id);
      if (leftConfiguredOrder !== rightConfiguredOrder) {
        if (leftConfiguredOrder === undefined) return 1;
        if (rightConfiguredOrder === undefined) return -1;
        return leftConfiguredOrder - rightConfiguredOrder;
      }

      const leftExistingOrder = left.route?.order;
      const rightExistingOrder = right.route?.order;
      if (leftExistingOrder !== rightExistingOrder) {
        if (leftExistingOrder === undefined) return 1;
        if (rightExistingOrder === undefined) return -1;
        return leftExistingOrder - rightExistingOrder;
      }

      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .map((page, index) => ({
      ...page,
      route: {
        order: index,
        stage: page.route?.stage ?? "implementation",
      },
    }));

  const supporting = pages.filter((page) => page.role !== "featured");
  return { pages: [...featured, ...supporting], warnings };
}
