<script lang="ts">
  import { EditorView, lineNumbers } from "@codemirror/view";
  import AppShell from "$ui/components/AppShell.svelte";
  import type { ConnectorRibbon } from "$ui/components/MergeConnector.svelte";
  import MergeFrame, { type MergeFrameParts } from "$ui/components/MergeFrame.svelte";
  import Text from "$ui/components/Text.svelte";
  import { editorTheme } from "$ui/editor/theme";

  const texts = {
    left: "const port = 3000;\nstart(port);\n",
    result: "const port = 8080;\nstart(port);\n",
    right: "const port = 8080;\nstart(port);\nlog('ready');\n",
  };
  // The app measures these from its editors; fixed here.
  const leftRibbons: ConnectorRibbon[] = [{ index: 0, kind: "conflict", aTop: 4, aBottom: 22, bTop: 4, bBottom: 22 }];
  const rightRibbons: ConnectorRibbon[] = [{ index: 1, kind: "added", aTop: 40, aBottom: 40, bTop: 40, bBottom: 58 }];
  let last = $state("Press a chunk's button");

  // The app builds its own editors into the panes; here plain ones.
  function build(parts: MergeFrameParts): () => void {
    const views = (["left", "result", "right"] as const).map(
      (side) => new EditorView({ parent: parts[side], doc: texts[side], extensions: [lineNumbers(), editorTheme] }),
    );
    return () => views.forEach((view) => view.destroy());
  }
</script>

<Text tone="dim">{last}</Text>
<AppShell height="medium">
  {#snippet editor()}
    <MergeFrame
      label="Merge server.ts"
      labels={{ left: "Yours: main", result: "Result", right: "Theirs: feature" }}
      fileName="server.ts"
      {leftRibbons}
      {rightRibbons}
      onapply={(index, side) => (last = `Apply chunk ${index + 1} from the ${side}`)}
      onignore={(index, side) => (last = `Ignore chunk ${index + 1} from the ${side}`)}
      onready={build}
    />
  {/snippet}
</AppShell>
