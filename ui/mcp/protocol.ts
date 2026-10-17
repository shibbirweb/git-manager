// A minimal MCP server over JSON-RPC 2.0 (the stdio transport sends one JSON message per line): initialize, the
// tools and the component pages as resources. server.ts only moves lines; this module answers them.
import {
  componentIndex,
  getComponent,
  getTokens,
  listComponents,
  listIcons,
  RULES,
  searchComponents,
  type TokenCategory,
} from "./tools";
import { componentDocs } from "../web/src/lib/docs";

export interface Request {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: "list_components",
    description: "List the Nibtree UI components with their group and one-line summary.",
    inputSchema: { type: "object", properties: { group: { type: "string", description: "e.g. Forms" } } },
  },
  {
    name: "search_components",
    description: "Find components by words, e.g. 'confirm delete', 'tabs', 'toast'. Searches names, aliases and usage.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "get_component",
    description: "A component's full doc: when to use it, every prop, rules, examples, its source and a story.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "get_tokens",
    description: "Design tokens shared by every platform: colors, typography, sizes, layout or components.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", enum: ["colors", "typography", "sizes", "layout", "components"] } },
      required: ["category"],
    },
  },
  { name: "list_icons", description: "Every icon name for Icon and the icon props.", inputSchema: { type: "object" } },
  { name: "get_rules", description: "The rules for building UI with the library.", inputSchema: { type: "object" } },
];

function text(value: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function callTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "list_components":
      return text(listComponents(typeof args.group === "string" ? args.group : undefined));
    case "search_components":
      return text(searchComponents(String(args.query ?? "")));
    case "get_component": {
      const answer = getComponent(String(args.name ?? ""));
      if (!answer) {
        return { ...text(`No component named ${String(args.name)}. Use list_components.`), isError: true };
      }
      const parts = [answer.markdown, "## Source", "```svelte", answer.source.trim(), "```"];
      if (answer.example) {
        parts.push("## Story", "```svelte", answer.example.trim(), "```");
      }
      return text(parts.join("\n"));
    }
    case "get_tokens":
      return text(getTokens(String(args.category ?? "colors") as TokenCategory) ?? "Unknown category");
    case "list_icons":
      return text(listIcons());
    case "get_rules":
      return text(RULES.map((rule) => `- ${rule}`).join("\n"));
    default:
      return { ...text(`Unknown tool ${name}`), isError: true };
  }
}

/** The response to one request, or null for a notification. */
export function handle(request: Request): Record<string, unknown> | null {
  if (request.id === undefined || request.id === null) {
    return null;
  }
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: request.id, result });
  const params = request.params ?? {};
  switch (request.method) {
    case "initialize":
      return reply({
        protocolVersion: String(params.protocolVersion ?? "2025-06-18"),
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "git-manager-ui", version: "1.0.0" },
        instructions: "Nibtree's UI library and design system. " + RULES.join(" "),
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      return reply(callTool(String(params.name ?? ""), (params.arguments ?? {}) as Record<string, unknown>));
    case "resources/list":
      return reply({
        resources: [
          { uri: "gm-ui://components", name: "COMPONENTS.md", mimeType: "text/markdown" },
          ...componentDocs.map((doc) => ({
            uri: `gm-ui://components/${doc.name}`,
            name: doc.name,
            mimeType: "text/markdown",
          })),
        ],
      });
    case "resources/read": {
      const uri = String(params.uri ?? "");
      const name = uri.replace(/^gm-ui:\/\/components\/?/, "");
      const body = name ? getComponent(name)?.markdown : componentIndex();
      return body
        ? reply({ contents: [{ uri, mimeType: "text/markdown", text: body }] })
        : { jsonrpc: "2.0", id: request.id, error: { code: -32002, message: `No resource ${uri}` } };
    }
    default:
      return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown method ${request.method}` } };
  }
}
