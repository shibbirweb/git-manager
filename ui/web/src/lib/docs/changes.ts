import { prop, type ComponentDoc } from "./types";

const GAP = '"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"';

export const changesDocs: ComponentDoc[] = [
  {
    name: "ListRegion",
    group: "Navigation",
    summary: "A focusable listbox the app fills with grouped content and drives with its own keys.",
    usage:
      "Use when a list is not one flat set of items, such as the Changes panel: repository headers, folding " +
      "groups and a commit box between the rows. It keeps the focus, so selected Rows inside show the strong " +
      "color. The app handles the keys in `onkeydown`, gives each row an id and passes the current one as " +
      "`activeId`; `focus()` takes the focus after a click and `reveal()` scrolls the current row into view. " +
      "For a flat list use List, which owns the keys itself.",
    aliases: ["Listbox", "Grouped list", "Active descendant"],
    props: [
      prop("label", "string", "Accessible name.", { required: true }),
      prop("role", '"listbox" | "tree"', "A list of rows, or a tree whose rows fold (the AI panel's projects).", {
        default: '"listbox"',
      }),
      prop("busy", "boolean", "Tells screen readers it is loading.", { default: "false" }),
      prop("activeId", "string", "The id of the row screen readers read as the current one.", { data: true }),
      prop("paddingY", GAP, "Space above the first row and under the last.", { default: '"none"' }),
      prop("onkeydown", "(event: KeyboardEvent) => void", "Keys pressed while it or something inside has the focus."),
      prop("children", "Snippet", "The rows and groups.", { required: true }),
    ],
    examples: [
      {
        title: "The Changes list",
        code:
          '<ListRegion label="Changed files" activeId={rowId} paddingY="xs" {onkeydown} bind:this={list}>\n' +
          "  {#each sections as section}<RepoSection {section} />{/each}\n</ListRegion>",
      },
    ],
    replaces: ['<div class="file-list" role="listbox" tabindex="0"> in ChangesView.svelte'],
    rules: ["Give every selectable row a unique id, and keep `activeId` on a row that is drawn."],
  },
  {
    name: "ElementHost",
    group: "Layout",
    summary: "A box whose element the app fills itself, such as a terminal that moves between places.",
    usage:
      "Use only for content the app builds or moves outside Svelte's markup (xterm.js, a parked terminal). The " +
      "app gets the element in `onready`; everything else on a screen is library components.",
    aliases: ["Mount point", "Slot", "Portal target"],
    props: [
      prop("label", "string", "Accessible name; makes it a group for screen readers."),
      prop("fill", '"none" | "grow" | "cover"', "Its size: its content's, grow in a flex parent, or cover a " +
        "positioned parent.", { default: '"none"' }),
      prop("surface", '"none" | "editor"', "Paint the editor background behind it.", { default: '"none"' }),
      prop("hidden", "boolean", "Out of sight and out of the layout (hidden attribute), such as a parked terminal.", {
        default: "false",
      }),
      prop("clip", "boolean", "Hide what overflows its box.", { default: "false" }),
      prop("stretch", "boolean", "What the app mounts fills the box, such as a CodeMirror editor.", {
        default: "false",
      }),
      prop("onready", "(element: HTMLDivElement) => void | (() => void)", "The element, once in the page; may " +
        "return a cleanup that runs when it goes."),
      prop("children", "Snippet", "Content inside, before anything the app moves in."),
    ],
    examples: [
      {
        title: "A terminal tab's slot",
        code: '<ElementHost fill="grow" surface="editor" clip onready={(element) => attach(element)} />',
      },
    ],
    replaces: [
      '<div class="terminal-slot" bind:this={slot}> in TerminalSlot.svelte',
      '<div class="terminal-host"> and the parking frame in TerminalHost.svelte and TerminalFrame.svelte',
    ],
    rules: ["Never use it to draw UI: screens are built from components, not from elements the app makes."],
  },
];
