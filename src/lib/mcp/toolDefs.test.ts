import { describe, expect, it } from "vitest";
import { MENU_ACTIONS } from "$lib/menu/menuIds";
import registrySource from "../../../src-tauri/src/mcp/registry.rs?raw";
import handlersSource from "./handlers.ts?raw";
import { defaultToolEnabled, MCP_CATEGORIES, UI_TOOLS } from "./toolDefs";

type Schema = Record<string, unknown>;

/** The parts of JSON Schema the tools use, checked strictly so a typo cannot slip through. */
function checkSchema(schema: Schema, where: string): void {
  const type = schema.type;
  expect(["object", "string", "integer", "number", "boolean", "array"], `${where} type`).toContain(type);
  if (schema.enum !== undefined) {
    expect(Array.isArray(schema.enum) && schema.enum.length > 0, `${where} enum`).toBe(true);
    expect(new Set(schema.enum as unknown[]).size, `${where} enum is unique`).toBe((schema.enum as unknown[]).length);
  }
  if (type === "object") {
    const properties = schema.properties as Record<string, Schema>;
    expect(properties && typeof properties === "object", `${where} properties`).toBe(true);
    for (const required of (schema.required as string[] | undefined) ?? []) {
      expect(Object.keys(properties), `${where} requires a known property`).toContain(required);
    }
    for (const [name, property] of Object.entries(properties)) {
      expect(name, `${where} property name`).toMatch(/^[a-z][A-Za-z]*$/);
      expect(typeof property.description === "string" && property.description.length > 0, `${where}.${name} description`).toBe(true);
      checkSchema(property, `${where}.${name}`);
    }
  }
  if (typeof schema.minimum === "number" && typeof schema.maximum === "number") {
    expect(schema.minimum, `${where} range`).toBeLessThanOrEqual(schema.maximum);
  }
}

describe("UI tools", () => {
  it("have unique snake_case names", () => {
    const names = UI_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("use the contract's categories", () => {
    for (const tool of UI_TOOLS) {
      expect(MCP_CATEGORIES, tool.name).toContain(tool.category);
    }
  });

  it("have object schemas that reject unknown arguments", () => {
    for (const tool of UI_TOOLS) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
      checkSchema(tool.inputSchema, tool.name);
    }
  });

  it("describe themselves in one or two plain sentences", () => {
    for (const tool of UI_TOOLS) {
      expect(tool.title.length, tool.name).toBeGreaterThan(0);
      const sentences = tool.description.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
      expect(sentences.length, tool.name).toBeGreaterThanOrEqual(1);
      expect(sentences.length, tool.name).toBeLessThanOrEqual(2);
      expect(tool.description.endsWith("."), tool.name).toBe(true);
      expect(`${tool.title} ${tool.description} ${JSON.stringify(tool.inputSchema)}`).not.toContain("\u2014");
    }
  });

  it("flag destructive tools as writing, and keep them off by default", () => {
    for (const tool of UI_TOOLS) {
      if (tool.destructive) {
        expect(tool.readOnly, tool.name).toBe(false);
      }
      expect(defaultToolEnabled(tool), tool.name).toBe(!tool.destructive);
    }
    const destructive = UI_TOOLS.filter((tool) => tool.destructive).map((tool) => tool.name);
    expect(destructive).toContain("send_terminal_text");
    expect(destructive).toContain("run_script");
    const readOnly = UI_TOOLS.filter((tool) => tool.readOnly).map((tool) => tool.name);
    expect(readOnly).toContain("get_app_state");
    expect(readOnly).toContain("get_ui_performance");
  });

  it("offer every menu action to run_menu_command", () => {
    const runMenu = UI_TOOLS.find((tool) => tool.name === "run_menu_command");
    const action = (runMenu?.inputSchema.properties as Record<string, Schema>).action;
    expect(action.enum).toEqual([...MENU_ACTIONS]);
  });

  it("all have a handler", () => {
    for (const tool of UI_TOOLS) {
      expect(handlersSource, tool.name).toMatch(new RegExp(`^  ${tool.name}: `, "m"));
    }
  });

  it("are all in the backend's clash check (FRONTEND_TOOLS in registry.rs)", () => {
    const list = /const FRONTEND_TOOLS: &\[&str\] = &\[([^\]]*)\];/.exec(registrySource);
    expect(list, "FRONTEND_TOOLS in src-tauri/src/mcp/registry.rs").not.toBeNull();
    const rustNames = [...(list?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect([...rustNames].sort()).toEqual(UI_TOOLS.map((tool) => tool.name).sort());
  });
});
