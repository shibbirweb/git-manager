<!-- Formatting buttons and the view mode switch above a Markdown file, like JetBrains' Markdown editor. -->
<script lang="ts">
  import type { EditorState, TransactionSpec } from "@codemirror/state";
  import {
    insertTable,
    setHeading,
    toggleCodeBlock,
    toggleInline,
    toggleLinePrefix,
    toggleLink,
  } from "$lib/markdown/format";
  import type { RichAction } from "$lib/markdown/richEditor";
  import type { MarkdownViewMode } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import { contextMenu } from "$lib/ui/menu.svelte";

  type FormatCommand = (state: EditorState) => TransactionSpec;

  interface Props {
    viewMode: MarkdownViewMode;
    onViewMode: (viewMode: MarkdownViewMode) => void;
    /** Formatting in the text editor. */
    onFormat: (command: FormatCommand) => void;
    /** Formatting in the rich text editor (Preview mode). */
    onRichFormat: (action: RichAction) => void;
    onRichLink: () => void;
  }

  let { viewMode, onViewMode, onFormat, onRichFormat, onRichLink }: Props = $props();

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
    { icon: "bold", label: "Bold (Cmd+B)", command: (state) => toggleInline(state, "bold"), richAction: "bold" },
    { icon: "italic", label: "Italic (Cmd+I)", command: (state) => toggleInline(state, "italic"), richAction: "italic" },
    { icon: "strikethrough", label: "Strikethrough", command: (state) => toggleInline(state, "strikethrough"), richAction: "strikethrough" },
    { icon: "code", label: "Inline code", command: (state) => toggleInline(state, "code"), richAction: "code" },
    { icon: "link", label: "Link (Cmd+K)", command: toggleLink, richAction: null },
  ];

  const blockButtons: FormatButton[] = [
    { icon: "list", label: "Bulleted list", command: (state) => toggleLinePrefix(state, "bullet"), richAction: "bullet" },
    { icon: "list-ordered", label: "Numbered list", command: (state) => toggleLinePrefix(state, "ordered"), richAction: "ordered" },
    { icon: "list-checks", label: "Task list", command: (state) => toggleLinePrefix(state, "task"), richAction: "task" },
    { icon: "quote", label: "Quote", command: (state) => toggleLinePrefix(state, "quote"), richAction: "quote" },
    { icon: "code-block", label: "Code block", command: toggleCodeBlock, richAction: "codeBlock" },
    { icon: "table", label: "Table", command: (state) => insertTable(state), richAction: "table" },
  ];

  function press(button: FormatButton): void {
    if (!rich) {
      onFormat(button.command);
    } else if (button.richAction) {
      onRichFormat(button.richAction);
    } else {
      onRichLink();
    }
  }

  const modes: { value: MarkdownViewMode; icon: IconName; label: string }[] = [
    { value: "editor", icon: "editor-only", label: "Editor Only" },
    { value: "split", icon: "split-view", label: "Editor and Preview" },
    { value: "preview", icon: "eye", label: "Preview Only" },
  ];

  /** The editor keeps its focus and selection while a button is clicked. */
  function keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  function openHeadings(event: MouseEvent): void {
    const headings: RichAction[] = ["heading1", "heading2", "heading3"];
    const levels = [1, 2, 3].map((level) => ({
      label: `Heading ${level}`,
      action: () => (rich ? onRichFormat(headings[level - 1]) : onFormat((state) => setHeading(state, level))),
    }));
    contextMenu.open(event, [
      ...levels,
      { separator: true },
      { label: "Normal text", action: () => (rich ? onRichFormat("paragraph") : onFormat((state) => setHeading(state, 0))) },
    ]);
  }
</script>

<div class="markdown-toolbar" role="toolbar" aria-label="Markdown">
  <div class="format">
    {#each inlineButtons as button (button.icon)}
      <button class="tool" onmousedown={keepFocus} onclick={() => press(button)} title={button.label} aria-label={button.label}>
        <Icon name={button.icon} size={14} />
      </button>
    {/each}
    <button class="tool heading" onmousedown={keepFocus} onclick={openHeadings} title="Heading" aria-label="Heading" aria-haspopup="menu">
      <Icon name="heading" size={14} />
      <Icon name="chevron-down" size={10} />
    </button>
    <span class="divider" aria-hidden="true"></span>
    {#each blockButtons as button (button.icon)}
      <button class="tool" onmousedown={keepFocus} onclick={() => press(button)} title={button.label} aria-label={button.label}>
        <Icon name={button.icon} size={14} />
      </button>
    {/each}
  </div>
  <div class="modes" role="radiogroup" aria-label="Markdown view">
    {#each modes as mode (mode.value)}
      <button
        role="radio"
        aria-checked={viewMode === mode.value}
        class:on={viewMode === mode.value}
        onclick={() => onViewMode(mode.value)}
        title={mode.label}
        aria-label={mode.label}
      >
        <Icon name={mode.icon} size={14} />
      </button>
    {/each}
  </div>
</div>

<style>
  .markdown-toolbar {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    min-height: 32px;
    padding: 3px 10px 3px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .format {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1px;
    min-width: 0;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    height: 24px;
    min-width: 26px;
    padding: 0 5px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .divider {
    width: 1px;
    height: 16px;
    margin: 0 5px;
    background: var(--border-strong);
  }

  .modes {
    flex: none;
    display: flex;
    margin-left: auto;
    padding: 2px;
    border-radius: 6px;
    border: 1px solid var(--border-strong);
    background: var(--panel-alt);
  }

  .modes button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .modes button:hover:not(.on) {
    color: var(--text);
  }

  .modes button.on {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 18%, transparent);
  }
</style>
