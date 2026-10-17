<!-- The app's one context menu: `contextMenu.open(...)` anywhere shows it here, on the UI library's Menu (submenus,
     keys, a letter jumps to an item). Every open starts fresh. -->
<script lang="ts">
  import Menu from "@nibtree/ui/components/Menu.svelte";
  import { contextMenu } from "./menu.svelte";
</script>

{#if contextMenu.visible}
  {#key contextMenu.version}
    <Menu
      items={contextMenu.items}
      x={contextMenu.x}
      y={contextMenu.y}
      alignEnd={contextMenu.alignEnd}
      keyboard={contextMenu.keyboard}
      onclose={(restoreFocus) => contextMenu.close(restoreFocus)}
    />
  {/key}
{/if}
