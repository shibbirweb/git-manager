import { prop, type ComponentDoc } from "./types";

export const sessionDocs: ComponentDoc[] = [
  {
    name: "SessionTabs",
    group: "Navigation",
    summary: "A strip of running sessions: state icon in its color, name and close; the selected one underlined.",
    usage: "Use above Run's output to switch between script runs.",
    aliases: ["Runs", "Session strip"],
    props: [
      prop("sessions", "{ key; name; icon; tone?: success|danger|dim; title? }[]", "The sessions.", {
        required: true,
        data: true,
      }),
      prop("value", "string | null", "The selected session's key.", { default: "null", bindable: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onselect", "(key: string) => void", "A session was selected."),
      prop("onclose", "(key: string) => void", "Shows close buttons; one was pressed."),
      prop("oncontextmenu", "(key: string, event: MouseEvent) => void", "Right-click, for its Menu."),
    ],
    examples: [{ title: "Runs", code: '<SessionTabs label="Runs" {sessions} bind:value onclose={stop} />' }],
    replaces: [".sessions in src/lib/terminal/RunView.svelte"],
  },
  {
    name: "PaletteRow",
    group: "Overlays",
    summary: "One row of a CommandPalette: icon or badge, title with matches, then check, reason, folder and keys.",
    usage: "CommandPalette draws these from its items; use it alone only in a custom list.",
    aliases: ["Palette item"],
    props: [
      prop("item", "PaletteItem", "What the row shows; see CommandPalette.", { required: true, data: true }),
      prop("selected", "boolean", "The highlighted row.", { default: "false" }),
      prop("onhover", "() => void", "The pointer moved over it."),
      prop("onpick", "() => void", "Clicked (not when disabled)."),
      prop("end", "Snippet", "Buttons at the end, such as Remove; shown while hovered or selected."),
    ],
    examples: [{ title: "A file", code: '<PaletteRow item={{ id: "a", title: "cart.ts", folder: "src" }} />' }],
    logic: ["palette.ts"],
    replaces: [".row in QuickOpen.svelte and RecentFiles.svelte"],
  },
];
