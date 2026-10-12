import { prop, type ComponentDoc } from "./types";

const GAP = '"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl"';
const TONE = '"default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning"';
const TEXT_SIZE =
  '"micro" | "tiny" | "xsmall" | "compact" | "small" | "codeSmall" | "ui" | "code" | "title" | "heading" | "display"';

export const layoutDocs: ComponentDoc[] = [
  {
    name: "Stack",
    group: "Layout",
    summary: "Lays out children in a row or a column with a gap from the spacing tokens.",
    usage:
      "Use for every layout instead of writing CSS: rows of buttons, label and value pairs, sections. " +
      "Gaps are steps (xxs 2, xs 4, sm 6, md 8, lg 12, xl 16, xxl 24 px), so a token change moves them all.",
    aliases: ["Flex", "HStack", "VStack", "Box"],
    props: [
      prop("direction", '"row" | "column"', "Main axis.", { default: '"column"' }),
      prop("gap", GAP, "Space between children.", { default: '"md"' }),
      prop("padding", GAP, "Space inside the edges.", { default: '"none"' }),
      prop("paddingX", `${GAP} | null`, "Space at the left and right, overriding `padding`.", { default: "null" }),
      prop("paddingY", `${GAP} | null`, "Space at the top and bottom, overriding `padding`.", { default: "null" }),
      prop("align", '"start" | "center" | "end" | "stretch" | "baseline"', "Cross-axis alignment.", {
        default: '"stretch"',
      }),
      prop("justify", '"start" | "center" | "end" | "between"', "Main-axis distribution.", { default: '"start"' }),
      prop("wrap", "boolean", "Wrap onto more lines.", { default: "false" }),
      prop("grow", "boolean", "Take the free space of its own parent stack.", { default: "false" }),
      prop("element", '"div" | "section" | "header" | "footer" | "ul" | "li" | "form"', "The HTML element.", {
        default: '"div"',
      }),
      prop("label", "string", "Accessible name, for sections and lists."),
      prop("children", "Snippet", "The content.", { required: true }),
    ],
    examples: [
      {
        title: "Dialog actions",
        code: '<Stack direction="row" justify="end" gap="md">\n  <Button>Cancel</Button>\n' +
          '  <Button variant="primary">Save</Button>\n</Stack>',
      },
    ],
    replaces: ['<div class="row">', '<div class="actions">', '<div class="toolbar">', "any flex container CSS"],
    rules: [
      "Do not add CSS for layout; combine Stacks. Gaps and padding come only from the named steps.",
      "There is no margin: space between items is the parent's gap, space inside is padding.",
    ],
  },
  {
    name: "Text",
    group: "Layout",
    summary: "Text in a named text style from the design tokens, so words never need a class or color.",
    usage:
      "Pick a `variant` (body, label, hint, caption, sectionLabel, panelTab, title, heading, display, paragraph, " +
      "code, codeSmall, badge, small, bodyStrong). `tone`, `size` and `weight` override the style only when a " +
      "screen truly differs. Use `truncate` for paths and names that may not fit.",
    aliases: ["Typography", "Label", "Heading"],
    props: [
      prop("variant", "TextStyleName", "The text style (see Foundations, Typography).", { default: '"body"' }),
      prop("tone", TONE, "Color from the theme; defaults to the style's tone."),
      prop("size", TEXT_SIZE, "Font size step, overriding the style's."),
      prop("weight", '"regular" | "medium" | "semibold" | "bold"', "Font weight, overriding the style's."),
      prop("mono", "boolean", "Monospace, for hashes, paths and code.", { default: "false" }),
      prop("truncate", "boolean", "One line with an ellipsis; give `title` the full text.", { default: "false" }),
      prop("selectable", "boolean", "Lets the user select the text (the app turns selection off by default).", {
        default: "false",
      }),
      prop("element", '"span" | "p" | "div" | "h1" | "h2" | "h3" | "label" | "code"', "The HTML element.", {
        default: '"span"',
      }),
      prop("title", "string", "Tooltip, e.g. the full text of a truncated path."),
      prop("children", "Snippet", "The text.", { required: true }),
    ],
    examples: [
      { title: "Hint", code: '<Text variant="hint">Created from the current branch</Text>' },
      { title: "Section label", code: '<Text variant="sectionLabel">Local branches</Text>' },
      { title: "A path that may not fit", code: "<Text mono truncate title={path}>{path}</Text>" },
    ],
    replaces: ['<span class="dim">', '<span class="hint">', '<span class="mono">', '<span class="truncate">'],
    rules: ["Prefer a variant over size and weight overrides, so a token change updates every screen."],
  },
  {
    name: "Grid",
    group: "Layout",
    summary: "A grid of equal columns: a fixed count, or as many as fit at a minimum width.",
    usage: "Use for cards, swatches and settings tiles. Use Stack for one row or one column.",
    aliases: ["Grid"],
    props: [
      prop("columns", '"auto" | "two" | "three" | "four" | "six"', "A named column count, or auto to fit as many " +
        "as `minColumn` allows.", { default: '"auto"' }),
      prop("minColumn", '"small" | "medium" | "large"', "Smallest column width for auto: 140, 180 or 240 px.", {
        default: '"medium"',
      }),
      prop("gap", GAP, "Space between cells.", { default: '"lg"' }),
      prop("label", "string", "Accessible name of the group."),
      prop("children", "Snippet", "The cells.", { required: true }),
    ],
    examples: [{ title: "Cards", code: "<Grid>\n  {#each repos as repo}<Card padded>...</Card>{/each}\n</Grid>" }],
    replaces: ["display: grid layouts written by hand"],
  },
  {
    name: "Card",
    group: "Layout",
    summary: "A bordered box that groups rows, like a worktree card in the AI panel.",
    usage: "Use to group related rows on a panel. Rows inside bring their own padding unless `padded` is set.",
    aliases: ["Card", "Panel"],
    props: [
      prop("label", "string", "Accessible name of the group."),
      prop("padded", "boolean", "Adds 12px padding for free content.", { default: "false" }),
      prop("children", "Snippet", "The rows.", { required: true }),
    ],
    examples: [{ title: "Worktree", code: '<Card label="main worktree" padded>...</Card>' }],
    replaces: ['<div class="card">'],
  },
  {
    name: "Divider",
    group: "Layout",
    summary: "A 1px line between groups: horizontal by default, vertical in toolbars.",
    usage: "Use between groups of buttons or sections. Strong is the menu separator color; soft is the row border.",
    aliases: ["Separator"],
    props: [
      prop("direction", '"horizontal" | "vertical"', "Line direction.", { default: '"horizontal"' }),
      prop("strong", "boolean", "The stronger border color.", { default: "true" }),
    ],
    examples: [{ title: "In a toolbar", code: '<Divider direction="vertical" />' }],
    replaces: ['<div class="separator">', '<div class="divider">'],
  },
];
