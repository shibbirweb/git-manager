import { prop, type ComponentDoc } from "./types";

const MENU_ITEM = "MenuItem (MenuCommand | MenuSubmenu | MenuSeparator, from logic/menuModel.ts)";

export const overlayDocs: ComponentDoc[] = [
  {
    name: "Dialog",
    group: "Overlays",
    summary: "A modal dialog over a dimmed window: a title, the content and the actions on the right.",
    usage:
      "Use for tasks that need a few inputs, such as New Branch. " +
      "Use the `message` variant for a yes or no question. " +
      "Keep one Primary button in `actions`, last.",
    aliases: ["Dialog", "Modal"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "false", bindable: true }),
      prop("title", "string", "The heading; also the dialog's accessible name.", { required: true }),
      prop("variant", '"message" | "form" | "split" | "panel"', "A question and buttons, the Git dialogs' form, " +
        "Settings' side column and content, or a large panel with a scrolling body (Shortcuts, What's New).", {
        default: '"message"',
      }),
      prop("width", '"small" | "normal" | "medium" | "large" | "xlarge" | "full"', "460, 520, 560, 620, 760 or " +
        "1200 px; split dialogs have their own size.", { default: "small (message), normal (form), large (panel)" }),
      prop("dismissible", "boolean", "Esc and a click on the dim area close it.", { default: "true" }),
      prop("movable", "boolean", "Drag the title to move it; double-click the title centers it.", { default: "false" }),
      prop("subtitle", "string", "A dim line under the title.", { default: '""' }),
      prop("icon", "IconName | null", "An icon on a tinted tile before the title.", { default: "null" }),
      prop("iconTone", '"accent" | "success" | "warning" | "danger"', "The tile's color.", { default: '"accent"' }),
      prop("toolbar", "Snippet", "A bar under the head, such as a Toolbar with a filter (panel dialogs)."),
      prop("footnote", "Snippet", "Content at the footer's start, such as a Link or a hint."),
      prop("onclose", "() => void", "Called when the user dismisses it (Esc or outside click)."),
      prop("onsubmit", "() => void", "Cmd+Enter (Ctrl+Enter): the main action of a form."),
      prop("enterSubmits", "boolean", "A plain Enter in a one-line field submits too, like a one-field prompt or " +
        "a password; Enter in a text area or on a button does not.", { default: "false" }),
      prop("actions", "Snippet", "Buttons on the right under the content."),
      prop("sidebar", "Snippet", "The side column of a split dialog, such as a SideNav."),
      prop("contentTitle", "string", "Split: a head over the content, such as the open section's name, with a " +
        "close button; with movable it drags the dialog too.", { default: '""' }),
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
      {
        title: "A prompt that Enter submits",
        code:
          '<Dialog bind:open title="Password" onsubmit={send} enterSubmits>\n' +
          '  <Input type="password" bind:value={password} />\n' +
          '  {#snippet actions()}<Button variant="primary" onclick={send}>OK</Button>{/snippet}\n</Dialog>',
      },
    ],
    logic: ["dialogKeys.ts"],
    replaces: [
      '<div class="overlay"><div class="dialog" role="dialog">...</div></div>',
      "Git menu dialogs",
      '<form onsubmit> around a prompt\'s field (Enter submits)',
    ],
    rules: ["Focus goes into the dialog when it opens and back when it closes; do not move it by hand."],
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
      prop("width", '"auto" | "small" | "medium" | "large"', "Fits the content, or 256, 300 or 360 px.", {
        default: '"auto"',
      }),
      prop("padding", '"menu" | "panel" | "form"', "4px for menu-like lists, 12 by 14px for detail panels, 12px " +
        "and a column of fields for a small form (Commit Options).", {
        default: '"menu"',
      }),
      prop("textSize", '"normal" | "small"', "Small (12px) for the status bar's popovers.", { default: '"normal"' }),
      prop("layer", '"anchor" | "window"', "Under its trigger in the page, or floating over the window and kept " +
        "inside it, so a scrolling or narrow panel cannot cut it off (Commit Options).", { default: '"anchor"' }),
      prop("autofocus", "boolean", "Its first field takes the focus when it opens, and Esc gives the focus back " +
        "to the trigger, for a small form.", { default: "false" }),
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
    replaces: [
      '<div class="details" role="dialog"> in StatusBar',
      '<div class="menu"> in KeepAwake and AiUsage',
      '<div class="panel" role="dialog"> with its fixed place in CommitOptionsPopover.svelte',
    ],
    logic: ["popoverPlace.ts"],
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
      prop("x", "number", "Left edge (or right edge with alignEnd), viewport px.", { required: true, data: true }),
      prop("y", "number", "Top edge, viewport px; it moves up when it would not fit.", { required: true, data: true }),
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
      prop("ondismiss", "(id: number) => void", "Close one (the x button).", { required: true, data: true }),
      prop("onaction", "(id: number) => void", "Run a toast's button, then close it.", { data: true }),
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
