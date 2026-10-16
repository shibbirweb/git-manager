// "- [ ]" and "- [x]" list items become task checkboxes, like the app's preview: the item gets the
// task-list-item class, its list contains-task-list, and the box carries its source line so a click can edit it.
import MarkdownIt from "markdown-it";
import type { StateCore } from "markdown-it";

const TASK_MARK = /^\[([ xX])\][ \t]+/;

function taskLists(state: StateCore): void {
  const tokens = state.tokens;
  for (let index = 2; index < tokens.length; index++) {
    const inline = tokens[index];
    const item = tokens[index - 2];
    if (inline.type !== "inline" || tokens[index - 1].type !== "paragraph_open" || item.type !== "list_item_open") {
      continue;
    }
    const first = inline.children?.[0];
    const match = first?.type === "text" ? TASK_MARK.exec(first.content) : null;
    if (!first || !match || !item.map) {
      continue;
    }
    first.content = first.content.slice(match[0].length);
    inline.content = inline.content.replace(TASK_MARK, "");
    const checkbox = new state.Token("task_checkbox", "input", 0);
    checkbox.meta = { checked: match[1] !== " ", line: item.map[0] };
    inline.children?.unshift(checkbox);
    item.attrJoin("class", "task-list-item");
    // The list that holds the item: the nearest list opening one level up.
    for (let back = index - 3; back >= 0; back--) {
      const candidate = tokens[back];
      const list = candidate.type === "bullet_list_open" || candidate.type === "ordered_list_open";
      if (list && candidate.level === item.level - 1) {
        if (!String(candidate.attrGet("class") ?? "").includes("contains-task-list")) {
          candidate.attrJoin("class", "contains-task-list");
        }
        break;
      }
    }
  }
}

/** Adds task lists to a markdown-it instance. */
export function useTaskLists(markdown: InstanceType<typeof MarkdownIt>): void {
  markdown.core.ruler.push("gm_task_lists", taskLists);
  markdown.renderer.rules.task_checkbox = (tokens, index) => {
    const meta = tokens[index].meta as { checked: boolean; line: number };
    const checked = meta.checked ? " checked" : "";
    return `<input type="checkbox" class="task-list-item-checkbox" data-task-line="${meta.line}"${checked}> `;
  };
}
