<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import RichEditorHost from "$ui/components/RichEditorHost.svelte";

  // No TipTap here: the story puts an editable document in the host to show its typography.
  function mount(element: HTMLDivElement): void {
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    editor.contentEditable = "true";
    editor.innerHTML = "<h1>Release notes</h1><p>Type here. <strong>Bold</strong> and <code>code</code> work.</p>";
    element.append(editor);
  }
</script>

<Card label="Rich editor">
  <RichEditorHost
    label="Release notes"
    notice="This file is read-only: it is outside the repository."
    onready={mount}
  />
</Card>
