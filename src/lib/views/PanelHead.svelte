<!-- Title row of a sidebar panel, like the Changes and Files panels: the name, buttons and a close X. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import PanelHeader from "@git-manager/ui/components/PanelHeader.svelte";

  interface Props {
    title: string;
    /** Tooltip of the close button. */
    hideTitle: string;
    onhide: () => void;
    /** Buttons left of the close button. */
    children?: Snippet;
  }

  let { title, hideTitle, onhide, children }: Props = $props();
</script>

<PanelHeader {title}>
  {#snippet actions()}
    {@render children?.()}
    <IconButton icon="x" iconSize="normal" size="compact" label={hideTitle} onclick={onhide} />
  {/snippet}
</PanelHeader>
