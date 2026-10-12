import { prop, type ComponentDoc } from "./types";

const OPTIONS = "SearchOptions ({ matchCase: boolean; wholeWords: boolean; regex: boolean })";

export const editorDocs: ComponentDoc[] = [
  {
    name: "SearchToggles",
    group: "Editor",
    summary: "Match Case, Words and Regex toggles inside a search field.",
    usage: "Use inside a find field. Pass tooltips with keys from localKeys(...) in `titles`.",
    aliases: ["Toggle group"],
    props: [
      prop("options", OPTIONS, "Which toggles are on.", { required: true, bindable: true }),
      prop("compact", "boolean", "Smaller toggles for the editor's find bar.", { default: "false" }),
      prop("titles", "Partial<Record<keyof SearchOptions, string>>", "Tooltips with their keys.", { default: "{}" }),
      prop("onchange", "(options: SearchOptions) => void", "Called with the new options."),
    ],
    examples: [{ title: "Find in Files", code: "<SearchToggles bind:options />" }],
    replaces: ["src/lib/ui/SearchToggles.svelte"],
    rules: ["Never type keys into a tooltip; pass them through `titles` from localKeys."],
  },
  {
    name: "FindBar",
    group: "Editor",
    summary: "The editor's find and replace bar: find field with toggles, match counter, previous, next and close.",
    usage:
      "Use above an editor. Enter goes to the next match, Shift+Enter the previous, Esc closes. Read-only " +
      "editors pass `editable={false}`, which hides Replace.",
    aliases: ["Find", "Search bar"],
    props: [
      prop("query", "string", "The search text.", { default: '""', bindable: true }),
      prop("replacement", "string", "The replace text.", { default: '""', bindable: true }),
      prop("options", OPTIONS, "Toggles.", { default: "all false", bindable: true }),
      prop("showReplace", "boolean", "The Replace row is open.", { default: "false", bindable: true }),
      prop("editable", "boolean", "Offer Replace (hidden for read-only editors).", { default: "true" }),
      prop("current", "number", "The current match, from 1.", { default: "0", data: true }),
      prop("total", "number", "How many matches.", { default: "0", data: true }),
      prop("problem", "string | null", "Shown in red instead of the counter, e.g. `Bad regex`.", { default: "null" }),
      prop("onsearch", "(query: string, options: SearchOptions) => void", "The query or a toggle changed."),
      prop("onnext", "() => void", "Next match (Enter or the down arrow)."),
      prop("onprevious", "() => void", "Previous match (Shift+Enter or the up arrow)."),
      prop("onreplace", "() => void", "Replace the current match."),
      prop("onreplaceall", "() => void", "Replace every match."),
      prop("onselectall", "() => void", "Select every match; shows the button (hidden when the bar is narrow)."),
      prop("onexclude", "() => void", "Skip this match; shows Exclude in the Replace row (hidden when narrow)."),
      prop("onclose", "() => void", "Esc or the close button."),
    ],
    examples: [
      {
        title: "Editor find",
        code: "<FindBar bind:query {current} {total} onnext={next} onprevious={previous} onclose={close} />",
      },
    ],
    replaces: ["src/lib/editor/FindBar.svelte's markup (the search logic stays in the editor)"],
  },
  {
    name: "CodeView",
    group: "Editor",
    summary: "Read-only, highlighted code with line numbers and a Copy button, in CodeMirror like the editors.",
    usage: "Use to show code, output or a file's text without editing. Use the app's editor for editing.",
    aliases: ["Code block", "Code"],
    props: [
      prop("source", "string", "The text.", { required: true }),
      prop("language", '"svelte" | "html" | "ts" | "js" | "md" | "plain"', "Highlighting.", { default: '"plain"' }),
      prop("lineNumbers", "boolean", "Show line numbers.", { default: "true" }),
      prop("copy", "boolean", "Show the Copy button.", { default: "true" }),
      prop("maxHeight", '"none" | "small" | "medium" | "large"', "Scroll beyond 200, 360 or 520 px; none fits.", {
        default: '"large"',
      }),
    ],
    examples: [{ title: "A snippet", code: '<CodeView source={code} language="ts" />' }],
    replaces: ["read-only CodeMirror views built by hand"],
  },
];
