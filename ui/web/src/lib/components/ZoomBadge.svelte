<!-- A floating badge at the top of the window that shows a value for a moment, such as the zoom level after
     Cmd+Plus. The caller shows it (`open`) and hides it after a short time. -->
<script lang="ts">
  interface Props {
    open?: boolean;
    text: string;
  }

  let { open = true, text }: Props = $props();
</script>

{#if open}
  <div class="zoom-badge" role="status" aria-live="polite">{text}</div>
{/if}

<style>
  .zoom-badge {
    position: fixed;
    top: var(--zoom-badge-top);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1100;
    padding: var(--zoom-badge-padding-y) var(--zoom-badge-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--zoom-badge-radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    font-size: var(--font-size-code-small);
    font-weight: var(--font-weight-medium);
    pointer-events: none;
  }
</style>
