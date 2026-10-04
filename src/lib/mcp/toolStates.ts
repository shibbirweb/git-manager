// The per-tool switches of Help > Available MCP Tools: settings.json keeps only the tools
// switched away from their default, and the dialog filters and groups the list.

import type { McpToolInfo } from "$lib/types";
import { defaultToolEnabled, MCP_CATEGORIES } from "./toolDefs";

type ToolSwitch = Pick<McpToolInfo, "name" | "destructive"> & Partial<Pick<McpToolInfo, "defaultEnabled">>;

/** The user's choice when there is one, else the default. */
export function toolEnabled(tool: ToolSwitch, toolStates: Record<string, boolean>): boolean {
  return toolStates[tool.name] ?? defaultToolEnabled(tool);
}

/** Sets tools on or off; a tool set back to its default leaves the record. */
export function withToolStates(
  toolStates: Record<string, boolean>,
  tools: ToolSwitch[],
  enabled: boolean,
): Record<string, boolean> {
  const next = { ...toolStates };
  for (const tool of tools) {
    if (enabled === defaultToolEnabled(tool)) {
      delete next[tool.name];
    } else {
      next[tool.name] = enabled;
    }
  }
  return next;
}

/** Tools switched away from their default (what Restore Defaults would change). */
export function changedTools<T extends ToolSwitch>(toolStates: Record<string, boolean>, tools: T[]): T[] {
  return tools.filter((tool) => toolEnabled(tool, toolStates) !== defaultToolEnabled(tool));
}

/** Puts tools back to their default: their recorded choices are dropped, the others stay. */
export function withDefaultStates(toolStates: Record<string, boolean>, tools: ToolSwitch[]): Record<string, boolean> {
  const next = { ...toolStates };
  for (const tool of tools) {
    delete next[tool.name];
  }
  return next;
}

/** The fields the list reads; categories are plain strings, since the backend may add new ones. */
interface ListedTool {
  name: string;
  title: string;
  description: string;
  category: string;
}

/** Tools whose name, title, description or category contain every word of the filter. */
export function filterTools<T extends ListedTool>(tools: T[], filter: string): T[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return tools;
  }
  return tools.filter((tool) => {
    const haystack = `${tool.name} ${tool.title} ${tool.description} ${tool.category}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface ToolGroup<T> {
  category: string;
  tools: T[];
}

/** Tools by category in the contract's order (unknown categories last), each sorted by title. */
export function groupTools<T extends Pick<ListedTool, "title" | "category">>(tools: T[]): ToolGroup<T>[] {
  const order = MCP_CATEGORIES as readonly string[];
  const byCategory = new Map<string, T[]>();
  for (const tool of tools) {
    byCategory.set(tool.category, [...(byCategory.get(tool.category) ?? []), tool]);
  }
  const rank = (category: string) => (order.includes(category) ? order.indexOf(category) : order.length);
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({ category, tools: [...list].sort((a, b) => a.title.localeCompare(b.title)) }));
}

export type ToolBadge = "read only" | "can change files" | "destructive";

export function toolBadge(tool: Pick<McpToolInfo, "readOnly" | "destructive">): ToolBadge {
  if (tool.destructive) {
    return "destructive";
  }
  return tool.readOnly ? "read only" : "can change files";
}

/** "31 of 58 tools on". */
export function toolCountLabel(enabledCount: number, total: number): string {
  return `${enabledCount} of ${total} ${total === 1 ? "tool" : "tools"} on`;
}
