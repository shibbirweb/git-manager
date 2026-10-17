<!-- The app's logo: the merge mark on an accent tile. `large` greets on the Welcome page and About. -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    size?: "normal" | "medium" | "large" | "soft";
    label?: string;
  }

  let { size = "normal", label = "Nibtree" }: Props = $props();
</script>

<div class="logo {size}" role="img" aria-label={label}>
  <Icon name="merge" size={size === "large" ? "display" : size === "soft" ? "giant" : "emphasis"} />
</div>

<style>
  .logo {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--logo-size);
    height: var(--logo-size);
    border-radius: var(--logo-radius);
    background: var(--accent);
    color: var(--accent-text);
  }

  .large {
    width: var(--logo-large-size);
    height: var(--logo-large-size);
    border-radius: var(--logo-large-radius);
  }

  /* Settings' About. */
  .medium {
    width: var(--logo-medium-size);
    height: var(--logo-medium-size);
    border-radius: var(--logo-medium-radius);
  }

  /* The empty editor's quiet mark: a tinted tile instead of a filled one. */
  .soft {
    width: var(--logo-soft-size);
    height: var(--logo-soft-size);
    border-radius: var(--logo-soft-radius);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
  }
</style>
