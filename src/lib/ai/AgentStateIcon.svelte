<!-- An agent's state as a small mark, like Orca's: a spinner while it works, a question mark when it needs you,
     a check when it is done, an empty ring while it waits for a first request. -->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import { stateLabel } from "./agentStatus";
  import type { AgentState } from "./projects";

  let { state }: { state: AgentState } = $props();
</script>

<span class="mark {state}" title={stateLabel(state)} role="img" aria-label={stateLabel(state)}>
  {#if state === "working" || state === "starting"}
    <span class="spinner"></span>
  {:else if state === "waiting"}
    <span class="question">?</span>
  {:else if state === "done"}
    <Icon name="check" size={11} strokeWidth={2.6} />
  {:else if state === "exited"}
    <Icon name="stop" size={9} />
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
    width: 14px;
    height: 14px;
    color: var(--text-dim);
  }

  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .question {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--warning);
    color: var(--editor-bg);
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .done {
    color: var(--success);
  }

  .ring {
    width: 8px;
    height: 8px;
    border: 1.5px solid var(--text-dim);
    border-radius: 50%;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
