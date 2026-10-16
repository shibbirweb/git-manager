<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import PaletteRow from "$ui/components/PaletteRow.svelte";
</script>

<Card label="Rows">
  <div role="listbox" aria-label="Rows">
    <PaletteRow item={{ id: "1", title: "cart.ts", ranges: [[0, 4]], icon: "file", folder: "src/lib" }} selected />
    <PaletteRow item={{ id: "2", title: "Pull", category: "Git", keys: "⇧⌘P" }} />
    <PaletteRow item={{ id: "3", title: "Word Wrap", category: "View", checked: true }} />
    <PaletteRow item={{ id: "4", title: "Push", category: "Git", disabled: true, reason: "No repository" }} />
    <PaletteRow
      item={{ id: "5", title: "total", badge: { letter: "F", tone: "function" }, depth: 1, container: "Cart" }}
    />
    <PaletteRow item={{ id: "6", title: "Go to line", prefix: ":" }} />
    <PaletteRow item={{ id: "7", title: "tax.ts", icon: "file", tone: "modified", dirty: true, folder: "src" }} />
  </div>
</Card>
