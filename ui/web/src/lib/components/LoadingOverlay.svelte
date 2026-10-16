<!-- A card over a dimmed window while something long happens, like opening a big folder: a spinner, a title, the
     current step and a hint. It does not take the keyboard; the work ends it. -->
<script lang="ts">
  interface Props {
    open?: boolean;
    title: string;
    step?: string;
    hint?: string;
  }

  let { open = true, title, step = "", hint = "" }: Props = $props();
</script>

{#if open}
  <div class="backdrop" role="presentation">
    <div class="card" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <div class="text">
        <span class="title">{title}</span>
        {#if step}<span class="step">{step}</span>{/if}
        {#if hint}<span class="hint">{hint}</span>{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay);
    animation: fade-in var(--motion-normal) ease-out;
  }

  .card {
    display: flex;
    align-items: flex-start;
    gap: var(--loading-overlay-gap);
    width: min(var(--loading-overlay-width), calc(100vw - 2 * var(--space-8)));
    padding: var(--loading-overlay-padding-y) var(--loading-overlay-padding-x);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--loading-overlay-radius);
    box-shadow: var(--shadow);
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--loading-overlay-text-gap);
  }

  .title {
    font-weight: var(--font-weight-semibold);
  }

  .step {
    color: var(--text-dim);
    font-size: var(--font-size-code-small);
  }

  .hint {
    margin-top: var(--space-3);
    color: var(--text-faint);
    font-size: var(--font-size-small);
    line-height: 1.4;
  }

  .spinner {
    flex: none;
    width: var(--loading-overlay-spinner);
    height: var(--loading-overlay-spinner);
    margin-top: 1px;
    border: var(--border-width-thick) solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
