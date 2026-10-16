<!-- A small mark for an agent's or task's state: a spinner while starting or working, an orange question mark when
     it needs you, a check when done, a square when it exited, a ring when idle. -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  export type RunState = "starting" | "working" | "waiting" | "done" | "exited" | "idle";

  interface Props {
    state: RunState;
    label: string;
  }

  let { state, label }: Props = $props();
</script>

<span class="mark {state}" title={label} role="img" aria-label={label}>
  {#if state === "working" || state === "starting"}
    <span class="spinner"></span>
  {:else if state === "waiting"}
    <span class="question">?</span>
  {:else if state === "done"}
    <Icon name="check" size="small" stroke="bold" />
  {:else if state === "exited"}
    <Icon name="stop" size="xxsmall" />
  {:else}
    <span class="ring"></span>
  {/if}
</span>

<style>
  .mark {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--status-icon-size);
    height: var(--status-icon-size);
    color: var(--text-dim);
  }

  .spinner {
    width: var(--status-icon-spinner);
    height: var(--status-icon-spinner);
    border: var(--border-width-thick) solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .question {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--status-icon-question);
    height: var(--status-icon-question);
    border-radius: 50%;
    background: var(--warning);
    color: var(--editor-bg);
    font-size: var(--font-size-nano);
    font-weight: var(--font-weight-bold);
    line-height: 1;
  }

  .done {
    color: var(--success);
  }

  .ring {
    width: var(--status-icon-ring);
    height: var(--status-icon-ring);
    border: var(--border-width-mid) solid var(--text-dim);
    border-radius: 50%;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
