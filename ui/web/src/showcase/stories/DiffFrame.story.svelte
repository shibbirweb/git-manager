<script lang="ts">
  import { MergeView } from "@codemirror/merge";
  import { EditorView, lineNumbers } from "@codemirror/view";
  import DiffFrame, { type DiffFrameParts } from "$ui/components/DiffFrame.svelte";
  import AppShell from "$ui/components/AppShell.svelte";
  import { diffTheme, editorTheme } from "$ui/editor/theme";

  const extensions = [lineNumbers(), editorTheme, diffTheme, EditorView.editable.of(false)];
  let ratio = $state(0.5);

  // The app builds its own editors into the body; here a plain MergeView.
  function build(parts: DiffFrameParts): () => void {
    const merge = new MergeView({
      a: { doc: "const port = 3000;\nstart(port);\n", extensions },
      b: { doc: "const port = Number(env.PORT ?? 3000);\nstart(port);\nlog('ready');\n", extensions },
      parent: parts.body,
      gutter: true,
      highlightChanges: true,
    });
    return () => merge.destroy();
  }
</script>

<AppShell height="medium">
  {#snippet editor()}
    <DiffFrame
      label="server.ts"
      sideLabels={{ original: "Index", modified: "Working tree" }}
      bind:ratio
      onready={build}
    />
  {/snippet}
</AppShell>
