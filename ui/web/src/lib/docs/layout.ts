import { prop, type ComponentDoc } from "./types";

const NARROW_STEP = '"tiny" | "narrow" | "compact" | "medium" | null';

const CELL_WIDTH = "A set width so rows line up: icon 16, xxsmall 40 (a line number), xsmall 70 (a hash), small " +
  "80, medium 90, large 120, xlarge 140.";
const GAP = '"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"';
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
      "Gaps are steps (xxs 2, xs 4, sm 6, md 8, mdPlus 10, lg 12, lgPlus 14, xl 16, xxl 24, xxxl 32 px), so a " +
      "token change moves them all.",
    aliases: ["Flex", "HStack", "VStack", "Box"],
    props: [
      prop("direction", '"row" | "column"', "Main axis.", { default: '"column"' }),
      prop("gap", GAP, "Space between children.", { default: '"md"' }),
      prop("padding", GAP, "Space inside the edges.", { default: '"none"' }),
      prop("paddingX", `${GAP} | null`, "Space at the left and right, overriding `padding`.", { default: "null" }),
      prop("paddingY", `${GAP} | null`, "Space at the top and bottom, overriding `padding`.", { default: "null" }),
      prop("paddingLeft", `${GAP} | null`, "Space at the left only, overriding the others there: an indent, such " +
        "as a repository's own commit box under its header.", { default: "null" }),
      prop("align", '"start" | "center" | "end" | "stretch" | "baseline"', "Cross-axis alignment.", {
        default: '"stretch"',
      }),
      prop("justify", '"start" | "center" | "end" | "between"', "Main-axis distribution.", { default: '"start"' }),
      prop("wrap", "boolean", "Wrap onto more lines.", { default: "false" }),
      prop("grow", "boolean", "Take the free space of its own parent stack.", { default: "false" }),
      prop("shrink", 'boolean | "first"', "Its content's size, but it may give way when the row is too narrow (a " +
        "group of names that truncate); first gives way before its siblings, down to its smallest width, so " +
        "its buttons stay whole (a repository row's branch name shortens before the repository's).", {
        default: "false",
      }),
      prop("width", '"auto" | "icon" | "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge"', CELL_WIDTH, {
        default: '"auto"',
      }),
      prop("scroll", '"none" | "y" | "x" | "both"', "Scrolls its content in its own box; pair with `grow`.", {
        default: '"none"',
      }),
      prop("maxHeight", '"none" | "xsmall" | "small" | "medium" | "large"', "Grows up to 120, 160, 240 or 360 " +
        'px, then scrolls with `scroll="y"` (a short list in a dialog).', { default: '"none"' }),
      prop("maxWidth", '"none" | "page"', "At most 600 px wide (page), such as a page of settings that would read " +
        "badly across a wide window.", { default: '"none"' }),
      prop("height", '"auto" | "window"', "Its content's height, or the whole window's (a screen such as the " +
        "welcome screen).", { default: '"auto"' }),
      prop("surface", '"none" | "editor" | "panel" | "alt"', "Paints a theme background behind it: the editor, " +
        "a panel, or the alternate panel color.", { default: '"none"' }),
      prop("sticky", "boolean", "Stays at the top of the region scrolling under it, on the panel color with a " +
        "line under it.", { default: "false" }),
      prop("line", '"none" | "top" | "bottom"', "A strong line on its top or bottom edge, such as the commit box " +
        "docked under a list.", { default: '"none"' }),
      prop("element", '"div" | "span" | "section" | "header" | "footer" | "main" | "aside" | "nav" | "ul" | "li" | ' +
        '"form"', "The HTML element; main, aside and nav mark a page's regions for screen readers; span fits inside " +
        "a label, like a Checkbox's rich label.", { default: '"div"' }),
      prop("role", '"group" | "region" | "tabpanel" | "alert" | "status" | "presentation" | null', "Its role for " +
        "screen readers: tabpanel for the content under Tabs, alert for an error that appears.", { default: "null" }),
      prop("label", "string", "Accessible name, for sections and lists."),
      prop("busy", "boolean", "Tells screen readers it is loading (aria-busy), like a panel refreshing its list.", {
        default: "false",
      }),
      prop("responsive", "boolean", "Measures its width so what is inside can step aside with `hideAt` or " +
        "`dotAt`; read once.", { default: "false" }),
      prop("hideAt", NARROW_STEP, "In a responsive Toolbar or Stack under 220, 320, 480 or 600 px, it goes " +
        "with what it holds.", { default: "null" }),
      prop("children", "Snippet", "The content.", { required: true }),
      prop("onshown", "(shown: boolean) => void", "It got or lost a size, such as a hidden background tab: " +
        "drop heavy content (a preview's files) while it is hidden."),
    ],
    examples: [
      {
        title: "Dialog actions",
        code: '<Stack direction="row" justify="end" gap="md">\n  <Button>Cancel</Button>\n' +
          '  <Button variant="primary">Save</Button>\n</Stack>',
      },
      {
        title: "A row that drops parts when narrow",
        code: '<Stack direction="row" gap="xs" responsive>\n  <Text truncate>{repoName}</Text>\n' +
          '  <Text hideAt="narrow">{branchName}</Text>\n  <Stack direction="row" hideAt="tiny">{syncCounts}</Stack>\n' +
          '  <Badge count={changes} hideAt="tiny" />\n</Stack>',
      },
    ],
    replaces: [
      '<div class="row">',
      '<div class="actions">',
      '<div class="toolbar">',
      "any flex container CSS",
      "`container: name / inline-size` with `@container` rules that hide parts",
    ],
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
      prop("giveWay", "boolean", "With truncate: in a tight row it shortens before its neighbours, down to nothing, " +
        "so the row's smallest width leaves it out (a branch name next to buttons, a repository's folder after its " +
        "name).", { default: "false" }),
      prop("selectable", "boolean", "Lets the user select the text (the app turns selection off by default).", {
        default: "false",
      }),
      prop("tabular", "boolean", "Digits of one width, for times, durations, sizes and counts.", { default: "false" }),
      prop("wrap", '"normal" | "anywhere" | "pre"', "Anywhere breaks long paths; pre keeps line breaks (output).", {
        default: '"normal"',
      }),
      prop("strike", "boolean", "Struck through, like a deleted file's name.", { default: "false" }),
      prop("element", '"span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "label" | "code"', "The HTML element.", {
        default: '"span"',
      }),
      prop("hideAt", NARROW_STEP, "In a responsive Toolbar or Stack under 220, 320, 480 or 600 px, the " +
        "words hide but screen readers still read them.", { default: "null" }),
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
      prop("selected", "boolean", "The chosen card: an accent border.", { default: "false" }),
      prop("dim", "boolean", "Faded, for something gone or paused, like a missing worktree.", { default: "false" }),
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
      prop("hideAt", NARROW_STEP, "In a responsive Toolbar or Stack under 220, 320, 480 or 600 px, the " +
        "line goes.", { default: "null" }),
    ],
    examples: [{ title: "In a toolbar", code: '<Divider direction="vertical" />' }],
    replaces: ['<div class="separator">', '<div class="divider">'],
  },
];
