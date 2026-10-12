import { prop, type ComponentDoc } from "./types";

const LABEL_COLUMN = '"small" | "medium" | "large"';

export const panelDocs: ComponentDoc[] = [
  {
    name: "RichEditorHost",
    group: "Editor",
    summary: "The page a rich Markdown editor (TipTap) is mounted into, in the preview's typography.",
    usage: "Create the editor on the element given to `onready`. Show loading in `status`, read-only in `notice`.",
    aliases: ["Rich editor", "WYSIWYG"],
    props: [
      prop("label", "string", "Accessible name.", { required: true }),
      prop("status", "string", "A line while it loads or fails.", { default: '""' }),
      prop("notice", "string", "A warning, such as why the file is read-only.", { default: '""' }),
      prop("onready", "(element: HTMLDivElement) => void", "The element to mount the editor on.", {
        required: true,
      }),
    ],
    examples: [{ title: "Rich", code: '<RichEditorHost label="README.md" onready={(element) => mount(element)} />' }],
    replaces: ["src/lib/views/files/RichMarkdownView.svelte frame and styles"],
  },
  {
    name: "FloatingFindBar",
    group: "Editor",
    summary: "A find bar floating over a view that is not an editor, such as the terminal.",
    usage: "Use over terminals and previews. The editor's own find bar (with replace) is FindBar.",
    aliases: ["Find", "Search box"],
    props: [
      prop("query", "string", "What to find.", { default: '""', bindable: true }),
      prop("options", "SearchOptions", "Match case, whole words, regex.", {
        default: "all off",
        bindable: true,
      }),
      prop("counter", "string", "Such as 2 of 5.", { default: '""', data: true }),
      prop("problem", "boolean", "No match or a bad regex: tints it red.", { default: "false" }),
      prop("label", "string", "Accessible name.", { default: '"Find"' }),
      prop("element", "HTMLInputElement | null", "The field, for focus.", { default: "null", bindable: true }),
      prop("onsearch", "(query: string, options: SearchOptions) => void", "The query or options changed."),
      prop("onnext", "() => void", "Enter or the down button."),
      prop("onprevious", "() => void", "Shift+Enter or the up button."),
      prop("onclose", "() => void", "Esc or the close button."),
    ],
    examples: [
      {
        title: "Terminal",
        code: "<FloatingFindBar bind:query counter={counter} onnext={next} onclose={close} />",
      },
    ],
    replaces: ["src/lib/terminal/TerminalFindBar.svelte"],
  },
];
