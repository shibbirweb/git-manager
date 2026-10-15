<!-- The area of a terminal editor tab. It stays empty: TerminalHost moves the terminal's element in here. -->
<script lang="ts">
  import ElementHost from "@git-manager/ui/components/ElementHost.svelte";
  import { untrack } from "svelte";
  import { terminalStore } from "./terminalStore.svelte";

  let { terminalKey }: { terminalKey: number } = $props();

  function attach(element: HTMLDivElement): () => void {
    const key = terminalKey;
    untrack(() => terminalStore.setEditorSlot(key, element));
    return () => untrack(() => terminalStore.clearEditorSlot(key, element));
  }
</script>

<ElementHost fill="grow" surface="editor" clip onready={attach} />
