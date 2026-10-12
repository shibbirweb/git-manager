import { describe, expect, it } from "vitest";
import { handle } from "./protocol";
import { getComponent, getTokens, listComponents, listIcons, searchComponents } from "./tools";

describe("the design-system tools", () => {
  it("list every component, or one group", () => {
    expect(listComponents().length).toBeGreaterThan(40);
    expect(listComponents("forms").every((entry) => entry.group === "Forms")).toBe(true);
  });

  it("find components by words, aliases first", () => {
    expect(searchComponents("modal")[0]?.name).toBe("Dialog");
    expect(searchComponents("toggle group").map((entry) => entry.name)).toContain("Segmented");
    expect(searchComponents("nothing like this")).toEqual([]);
  });

  it("give a component's doc, source and story, whatever the case of its name", () => {
    const answer = getComponent("button");
    expect(answer?.doc.name).toBe("Button");
    expect(answer?.markdown).toContain("## Props");
    expect(answer?.source).toContain("$props()");
    expect(answer?.example).toContain("<Button");
    expect(getComponent("Nope")).toBeNull();
  });

  it("give tokens per category and the icon names", () => {
    expect(getTokens("colors")).toHaveProperty("accent");
    expect(getTokens("typography")).toHaveProperty("textStyles.hint");
    expect(getTokens("layout")).toHaveProperty("breakpoint.windowCompact", 900);
    expect(listIcons()).toContain("branch");
  });
});

describe("the protocol", () => {
  it("answers initialize, lists tools and calls one", () => {
    const init = handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    expect(init).toMatchObject({ id: 1, result: { serverInfo: { name: "git-manager-ui" } } });
    const tools = handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }) as { result: { tools: { name: string }[] } };
    expect(tools.result.tools.map((tool) => tool.name)).toContain("get_component");
    const call = handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_component", arguments: { name: "Switch" } },
    }) as { result: { content: { text: string }[] } };
    expect(call.result.content[0].text).toContain("# Switch");
  });

  it("reads component pages as resources and ignores notifications", () => {
    const page = handle({
      jsonrpc: "2.0",
      id: 4,
      method: "resources/read",
      params: { uri: "gm-ui://components/Tag" },
    }) as { result: { contents: { text: string }[] } };
    expect(page.result.contents[0].text).toContain("# Tag");
    expect(handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(handle({ jsonrpc: "2.0", id: 5, method: "nope" })).toMatchObject({ error: { code: -32601 } });
  });
});
