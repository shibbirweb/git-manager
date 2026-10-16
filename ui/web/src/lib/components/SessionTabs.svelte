<!-- A strip of running sessions, such as Run's script runs: each with its state icon in the state's color, its name
     and a close button (on hover and on the selected one); the selected one is underlined in the accent. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Session {
    key: string;
    name: string;
    icon: IconName;
    tone?: "success" | "danger" | "dim";
    title?: string;
  }

  interface Props {
    sessions: Session[];
    value?: string | null;
    label: string;
    onselect?: (key: string) => void;
    onclose?: (key: string) => void;
    oncontextmenu?: (key: string, event: MouseEvent) => void;
  }

  let { sessions, value = $bindable(null), label, onselect, onclose, oncontextmenu }: Props = $props();

  function select(key: string): void {
    value = key;
    onselect?.(key);
  }
</script>

<div class="sessions" role="tablist" aria-label={label}>
  {#each sessions as session (session.key)}
    <div
      class="session"
      class:selected={session.key === value}
      role="tab"
      tabindex="-1"
      aria-selected={session.key === value}
      title={session.title ?? session.name}
      onclick={() => select(session.key)}
      onkeydown={(event) => (event.key === "Enter" || event.key === " ") && select(session.key)}
      oncontextmenu={(event) => oncontextmenu?.(session.key, event)}
    >
      <span class="state {session.tone ?? 'dim'}"><Icon name={session.icon} size="small" /></span>
      <span class="name">{session.name}</span>
      {#if onclose}
        <button
          class="close"
          type="button"
          title="Close"
          aria-label="Close {session.name}"
          onclick={(event) => {
            event.stopPropagation();
            onclose(session.key);
          }}
        >
          <Icon name="x" size="small" />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .sessions {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: var(--session-tabs-gap);
    height: var(--session-tabs-height);
    padding: 0 var(--session-tabs-padding-x);
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
  }

  .session {
    display: flex;
    align-items: center;
    gap: var(--session-tabs-tab-gap);
    max-width: var(--session-tabs-tab-max-width);
    padding: 0 var(--session-tabs-tab-padding-right) 0 var(--session-tabs-tab-padding-left);
    border-bottom: var(--session-tabs-indicator) solid transparent;
    color: var(--text-dim);
    font-size: var(--font-size-small);
    cursor: pointer;
  }

  .session:hover {
    color: var(--text);
    background: var(--hover);
  }

  .session.selected {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .state {
    display: inline-flex;
  }

  .success {
    color: var(--success);
  }

  .danger {
    color: var(--danger);
  }

  .dim {
    color: var(--text-dim);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--session-tabs-close-size);
    height: var(--session-tabs-close-size);
    padding: 0;
    border: none;
    border-radius: var(--session-tabs-close-radius);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    visibility: hidden;
  }

  .session:hover .close,
  .session.selected .close {
    visibility: visible;
  }

  .close:hover {
    color: var(--text);
    background: var(--hover);
  }
</style>
