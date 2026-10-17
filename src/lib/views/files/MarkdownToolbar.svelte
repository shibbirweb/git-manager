<!--
  Formatting buttons above a Markdown file. The view mode switch
  sits in FileView's bar; this row stays because it is a tool, and it is kept as low as possible.
-->
<script lang="ts">
  import { localKeys } from "$lib/commands/commandRuntime";
  import type { EditorState, TransactionSpec } from "@codemirror/state";
  import { toggleInline, toggleLink } from "@nibtree/ui/markdown/format";
  import { insertTable, setHeading, toggleCodeBlock, toggleLinePrefix } from "@nibtree/ui/markdown/formatLines";
  import type { RichAction } from "@nibtree/ui/markdown/richEditor";
  import type { MarkdownViewMode } from "$lib/stores/settings.svelte";
  import FormatToolbar from "@nibtree/ui/components/FormatToolbar.svelte";
  import type { IconName } from "@nibtree/ui/icons";
  import { contextMenu } from "$lib/ui/menu.svelte";

  type FormatCommand = (state: EditorState) => TransactionSpec;

  interface Props {
    viewMode: MarkdownViewMode;
    /** Formatting in the text editor. */
    onFormat: (command: FormatCommand) => void;
    /** Formatting in the rich text editor (Preview mode). */
    onRichFormat: (action: RichAction) => void;
    onRichLink: () => void;
  }

  let { viewMode, onFormat, onRichFormat, onRichLink }: Props = $props();

  /** Preview mode edits the rendered document, so the buttons act there. */
  const rich = $derived(viewMode === "preview");

  interface FormatButton {
    icon: IconName;
    label: string;
    command: FormatCommand;
    /** The same in the rich editor; null runs `onRichLink`. */
    richAction: RichAction | null;
  }

  const inlineButtons: FormatButton[] = [
    {
      icon: "bold",
      label: `Bold (${localKeys("CmdOrCtrl+B")})`,
      command: (state) => toggleInline(state, "bold"),
      richAction: "bold",
    },
    {
      icon: "italic",
      label: `Italic (${localKeys("CmdOrCtrl+I")})`,
      command: (state) => toggleInline(state, "italic"),
      richAction: "italic",
    },
    {
      icon: "strikethrough",
      label: "Strikethrough",
      command: (state) => toggleInline(state, "strikethrough"),
      richAction: "strikethrough",
    },
    { icon: "code", label: "Inline code", command: (state) => toggleInline(state, "code"), richAction: "code" },
    { icon: "link", label: `Link (${localKeys("CmdOrCtrl+K")})`, command: toggleLink, richAction: null },
  ];

  const blockButtons: FormatButton[] = [
    {
      icon: "list",
      label: "Bulleted list",
      command: (state) => toggleLinePrefix(state, "bullet"),
      richAction: "bullet",
    },
    {
      icon: "list-ordered",
      label: "Numbered list",
      command: (state) => toggleLinePrefix(state, "ordered"),
      richAction: "ordered",
    },
    {
      icon: "list-checks",
      label: "Task list",
      command: (state) => toggleLinePrefix(state, "task"),
      richAction: "task",
    },
    { icon: "quote", label: "Quote", command: (state) => toggleLinePrefix(state, "quote"), richAction: "quote" },
    { icon: "code-block", label: "Code block", command: toggleCodeBlock, richAction: "codeBlock" },
    { icon: "table", label: "Table", command: (state) => insertTable(state), richAction: "table" },
  ];

  // Inline tools, Heading with its menu, a divider, then the block tools.
  const items = [
    ...inlineButtons.map((button) => ({ id: button.icon, icon: button.icon, label: button.label })),
    { id: "heading", icon: "heading" as const, label: "Heading", menu: true },
    null,
    ...blockButtons.map((button) => ({ id: button.icon, icon: button.icon, label: button.label })),
  ];

  function act(id: string, element: HTMLElement): void {
    const button = [...inlineButtons, ...blockButtons].find((entry) => entry.icon === id);
    if (button) {
      press(button);
    } else if (id === "heading") {
      openHeadings(element);
    }
  }

  function press(button: FormatButton): void {
    if (!rich) {
      onFormat(button.command);
    } else if (button.richAction) {
      onRichFormat(button.richAction);
    } else {
      onRichLink();
    }
  }

  /** The heading levels in a menu under the Heading tool. */
  function openHeadings(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const event = new MouseEvent("contextmenu", { clientX: rect.left, clientY: rect.bottom });
    const headings: RichAction[] = ["heading1", "heading2", "heading3"];
    const levels = [1, 2, 3].map((level) => ({
      label: `Heading ${level}`,
      action: () => (rich ? onRichFormat(headings[level - 1]) : onFormat((state) => setHeading(state, level))),
    }));
    contextMenu.open(event, [
      ...levels,
      { separator: true },
      {
        label: "Normal text",
        action: () => (rich ? onRichFormat("paragraph") : onFormat((state) => setHeading(state, 0))),
      },
    ]);
  }
</script>

<FormatToolbar label="Markdown" {items} onaction={act} />
