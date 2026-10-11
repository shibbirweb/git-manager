import { prop, type ComponentDoc } from "./types";

const MENU_ITEM = "MenuItem (MenuCommand | MenuSubmenu | MenuSeparator, from logic/menuModel.ts)";

export const overlayDocs: ComponentDoc[] = [
  {
    name: "Dialog",
    group: "Overlays",
    summary: "A modal dialog over a dimmed window: a title, the content and the actions on the right.",
    usage:
      "Use for tasks that need a few inputs, such as New Branch. Use ConfirmDialog for a yes or no question. " +
      "Keep one Primary button in `actions`, last.",
    aliases: ["Dialog", "Modal"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "false", bindable: true }),
      prop("title", "string", "The heading; also the dialog's accessible name.", { required: true }),
      prop("width", '"normal" | "wide"', "460 or 640 px.", { default: '"normal"' }),
      prop("dismissible", "boolean", "Esc and a click on the dim area close it.", { default: "true" }),
      prop("onclose", "() => void", "Called when the user dismisses it (Esc or outside click)."),
      prop("actions", "Snippet", "Buttons on the right under the content."),
      prop("children", "Snippet", "The content.", { required: true }),
    ],
    examples: [
      {
        title: "New Branch",
        code:
          '<Dialog bind:open title="New Branch">\n  <Field label="Name"><Input bind:value={name} /></Field>\n' +
          '  {#snippet actions()}\n    <Button onclick={() => (open = false)}>Cancel</Button>\n' +
          '    <Button variant="primary" onclick={create}>Create</Button>\n  {/snippet}\n</Dialog>',
      },
    ],
    replaces: ['<div class="overlay"><div class="dialog" role="dialog">...</div></div>', "Git menu dialogs"],
    rules: ["Focus goes into the dialog when it opens and back when it closes; do not move it by hand."],
  },
  {
    name: "ConfirmDialog",
    group: "Overlays",
    summary: "Asks before an action: a title, a message and Cancel / OK; `danger` makes the confirm button red.",
    usage: "Use before anything that loses work or cannot be undone. The confirm label names the action.",
    aliases: ["Alert dialog", "Confirm"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "false", bindable: true }),
      prop("title", "string", "The question, e.g. `Discard all changes?`.", { required: true }),
      prop("message", "string", "What happens, in a sentence or two.", { default: '""' }),
      prop("confirmLabel", "string", "The confirm button, e.g. `Discard`.", { default: '"OK"' }),
      prop("cancelLabel", "string", "The cancel button.", { default: '"Cancel"' }),
      prop("danger", "boolean", "A red confirm button for destructive actions.", { default: "false" }),
      prop("onconfirm", "() => void", "Called on confirm.", { required: true }),
      prop("oncancel", "() => void", "Called on Cancel, Esc or an outside click."),
    ],
    examples: [
      {
        title: "Destructive",
        code:
          '<ConfirmDialog bind:open danger title="Discard all changes?" confirmLabel="Discard"\n' +
          "  onconfirm={discardAll} />",
      },
    ],
    replaces: ["dialogs.confirm({ title, message, danger }) from src/lib/ui/dialog.svelte.ts"],
    rules: ["Destructive actions always confirm first, with `danger`."],
  },
  {
    name: "Popover",
    group: "Overlays",
    summary: "A panel anchored to its trigger, like the AI usage panel; Esc or an outside click closes it.",
    usage: "Use for details or a few choices next to a control. Use Menu for a list of commands.",
    aliases: ["Popover", "Dropdown panel"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "false", bindable: true }),
      prop("label", "string", "Accessible name of the panel.", { required: true }),
      prop("placement", '"above" | "below"', "Which side of the trigger; above in the status bar.", {
        default: '"below"',
      }),
      prop("align", '"start" | "end"', "Which edge of the trigger it lines up with.", { default: '"start"' }),
      prop("width", "number | null", "Width in px; null fits the content.", { default: "null" }),
      prop("padding", '"menu" | "panel"', "4px for menu-like lists, 12 by 14px for detail panels.", {
        default: '"menu"',
      }),
      prop("textSize", '"normal" | "small"', "Small (12px) for the status bar's popovers.", { default: '"normal"' }),
      prop("trigger", "Snippet<[{ toggle: () => void; open: boolean }]>", "The button that opens it.", {
        required: true,
      }),
      prop("children", "Snippet", "The panel's content.", { required: true }),
    ],
    examples: [
      {
        title: "Status bar details",
        code:
          '<Popover label="AI usage" placement="above" align="end">\n' +
          "  {#snippet trigger({ toggle, open })}\n" +
          '    <IconButton icon="bot" label="AI usage" active={open} onclick={toggle} />\n' +
          "  {/snippet}\n  ...\n</Popover>",
      },
    ],
    replaces: ['<div class="details" role="dialog"> in StatusBar', '<div class="menu"> in KeepAwake and AiUsage'],
  },
  {
    name: "Menu",
    group: "Overlays",
    summary: "A context or drop-down menu at a point, with hints, separators and submenus; keyboard friendly.",
    usage:
      "Open it from oncontextmenu with the event's x and y, and render it while open. Use MenuButton for a " +
      'button that opens a menu. Item shapes match the app\'s contextMenu items.',
    aliases: ["Context menu", "Dropdown menu"],
    props: [
      prop("items", `${MENU_ITEM}[]`, "The entries.", { required: true }),
      prop("x", "number", "Left edge (or right edge with alignEnd), viewport px.", { required: true }),
      prop("y", "number", "Top edge, viewport px; it moves up when it would not fit.", { required: true }),
      prop("alignEnd", "boolean", "Line up the menu's right edge with x.", { default: "false" }),
      prop("keyboard", "boolean", "Highlight the first item at once (opened with the keyboard).", { default: "false" }),
      prop("label", "string", "Accessible name.", { default: '"Menu"' }),
      prop("onclose", "(restoreFocus: boolean) => void", "Close it; restoreFocus is true after Esc or a command.", {
        required: true,
      }),
    ],
    examples: [
      {
        title: "Context menu",
        code:
          "<div oncontextmenu={(event) => {\n  event.preventDefault();\n" +
          "  at = { x: event.clientX, y: event.clientY };\n}}>\n" +
          "{#if at}<Menu {items} x={at.x} y={at.y} onclose={() => (at = null)} />{/if}",
      },
    ],
    logic: ["menuModel.ts"],
    replaces: ["contextMenu.open(event, items) and ContextMenuHost.svelte"],
    rules: ["Shortcut hints come from commandKeys(id), never typed by hand."],
  },
  {
    name: "MenuButton",
    group: "Overlays",
    summary: 'A button that opens a Menu under itself, like a "..." button.',
    usage: "Use for a short list of actions behind one button. With `text` it is a Button, otherwise an IconButton.",
    aliases: ["Dropdown menu"],
    props: [
      prop("items", `${MENU_ITEM}[]`, "The entries.", { required: true }),
      prop("label", "string", "Accessible name and tooltip.", { required: true }),
      prop("icon", "IconName", "The icon.", { default: '"more"' }),
      prop("text", "string", "Show a text button instead of an icon button.", { default: '""' }),
      prop("alignEnd", "boolean", "Line up the menu's right edge with the button's.", { default: "false" }),
      prop("disabled", "boolean", "Disables the button.", { default: "false" }),
    ],
    examples: [{ title: "More actions", code: '<MenuButton label="More actions" items={actions} alignEnd />' }],
    logic: ["menuModel.ts"],
    replaces: ["contextMenu.openBelow(button, items)"],
  },
  {
    name: "ToastHost",
    group: "Overlays",
    summary: "Draws toasts in the bottom right corner: a colored edge for the kind, title, detail and buttons.",
    usage:
      "Render one per window with a store's items. The library's createToasts() is a simple store; the app's " +
      "toast store also records the notification history and renders through ToastHost the same way.",
    aliases: ["Toast", "Sonner", "Snackbar"],
    props: [
      prop("items", "ToastItem[] (logic/toastModel.ts)", "The toasts to show, oldest first.", { required: true }),
      prop("ondismiss", "(id: number) => void", "Close one (the x button).", { required: true }),
      prop("onaction", "(id: number) => void", "Run a toast's button, then close it."),
    ],
    examples: [
      {
        title: "With the library store",
        code:
          "const toasts = createToasts();\n" +
          "<ToastHost items={toasts.items} ondismiss={toasts.dismiss} onaction={toasts.runAction} />",
      },
    ],
    logic: ["toastModel.ts"],
    replaces: ["Toasts.svelte (the store stays toast.svelte.ts)"],
  },
];
