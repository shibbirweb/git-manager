<!--
  The bottom panel's Run tab: one tab per script, Rerun and
  Stop on the left, and the session's output (moved in here by TerminalHost) in the middle.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { type TerminalEntry, terminalStore } from "./terminalStore.svelte";

  let slotEl = $state<HTMLDivElement | null>(null);

  const sessions = $derived(terminalStore.runSessions);
  const active = $derived(sessions.find((session) => session.key === terminalStore.runActiveKey) ?? sessions[0] ?? null);
  const running = $derived(active !== null && active.terminalId !== null && !active.exited);

  $effect(() => {
    const element = slotEl;
    if (!element) {
      return;
    }
    untrack(() => terminalStore.setRunSlot(element));
    return () => {
      untrack(() => {
        if (terminalStore.runSlot === element) {
          terminalStore.setRunSlot(null);
        }
      });
    };
  });

  function status(session: TerminalEntry): { icon: IconName; tone: string; label: string } {
    if (!session.exited) {
      return { icon: "play", tone: "running", label: "Running" };
    }
    if (session.exitCode === 0) {
      return { icon: "check", tone: "ok", label: "Finished" };
    }
    if (session.exitCode === null) {
      return { icon: "stop", tone: "stopped", label: "Stopped" };
    }
    return { icon: "x", tone: "failed", label: `Exit code ${session.exitCode}` };
  }
</script>

<div class="run-view">
  <div class="sessions" role="tablist" aria-label="Runs">
    {#each sessions as session (session.key)}
      {@const state = status(session)}
      {@const selected = session.key === active?.key}
      <div
        class="session"
        class:selected
        role="tab"
        tabindex="-1"
        aria-selected={selected}
        title="{session.name}: {state.label}{session.run ? `\n${session.run.description}` : ''}"
        onclick={() => terminalStore.selectRun(session.key)}
        onkeydown={() => undefined}
        oncontextmenu={(event) => contextMenu.open(event, terminalStore.runMenuItems(session.key))}
      >
        <span class="state {state.tone}"><Icon name={state.icon} size={11} /></span>
        <span class="name truncate">{session.name}</span>
        <button
          class="close"
          title="Close"
          aria-label="Close {session.name}"
          onclick={(event) => {
            event.stopPropagation();
            void terminalStore.closeRun(session.key);
          }}
        >
          <Icon name="x" size={11} />
        </button>
      </div>
    {/each}
  </div>
  <div class="main">
    <div class="tools" role="toolbar" aria-label="Run actions" aria-orientation="vertical">
      <button
        class="icon-btn small rerun"
        onclick={() => active && terminalStore.rerun(active.key)}
        disabled={!active?.run}
        title={running ? "Stop and Rerun" : "Rerun"}
        aria-label="Rerun"
      >
        <Icon name="refresh" size={14} />
      </button>
      <button class="icon-btn small stop" onclick={() => active && terminalStore.stopRun(active.key)} disabled={!running} title="Stop" aria-label="Stop">
        <Icon name="stop" size={13} />
      </button>
    </div>
    <div class="slot" bind:this={slotEl}></div>
  </div>
</div>

<style>
  .run-view {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .sessions {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: 1px;
    height: 28px;
    padding: 0 6px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
  }

  .session {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    padding: 0 6px 0 10px;
    border-bottom: 2px solid transparent;
    color: var(--text-dim);
    font-size: 12px;
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

  .state.running,
  .state.ok {
    color: var(--success);
  }

  .state.failed {
    color: var(--danger);
  }

  .state.stopped {
    color: var(--text-dim);
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 3px;
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

  .main {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .tools {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 30px;
    padding-top: 4px;
    border-right: 1px solid var(--border);
  }

  .rerun:not(:disabled) {
    color: var(--success);
  }

  .stop:not(:disabled) {
    color: var(--danger);
  }

  .slot {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
