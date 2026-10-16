import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { useTaskLists } from "./markdownTasks";

function render(source: string): string {
  const markdown = new MarkdownIt();
  useTaskLists(markdown);
  return markdown.render(source);
}

describe("task lists", () => {
  it("turns task items into checkboxes with their source line", () => {
    const html = render("Intro\n\n- [x] Cart\n- [ ] Checkout\n");
    expect(html).toContain('<ul class="contains-task-list">');
    expect(html).toContain(
      '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" ' +
        'data-task-line="2" checked> Cart</li>',
    );
    expect(html).toContain('data-task-line="3"> Checkout');
  });

  it("leaves plain items and brackets elsewhere alone", () => {
    const html = render("- plain\n- [link](x)\n\n[x] not in a list\n");
    expect(html).not.toContain("checkbox");
    expect(html).toContain("<p>[x] not in a list</p>");
  });

  it("marks the nested list that holds a task, not the outer one", () => {
    const html = render("- outer\n  - [ ] inner\n");
    expect(html).toContain('<ul>\n<li>outer\n<ul class="contains-task-list">');
  });
});
