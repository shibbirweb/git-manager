<!--
  The bottom panel's Run tab: one tab per script, Rerun and
  Stop on the left, and the session's output (moved in here by TerminalHost) in the middle.
-->
<script lang="ts">
  import type { EditorTabData } from "@git-manager/ui/components/EditorTab.svelte";
  import ElementHost from "@git-manager/ui/components/ElementHost.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import TabStrip from "@git-manager/ui/components/TabStrip.svelte";
  import type { IconName } from "@git-manager/ui/icons";
  import { untrack } from "svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { type TerminalEntry, terminalStore } from "./terminalStore.svelte";

  const sessions = $derived(terminalStore.runSessions);
  const active = $derived(
    sessions.find((session) => session.key === terminalStore.runActiveKey) ?? sessions[0] ?? null,
  );
  const running = $derived(active !== null && active.terminalId !== null && !active.exited);
  const tabs = $derived(
    sessions.map((session): EditorTabData => {
      const state = status(session);
      return {
        id: String(session.key),
        label: session.name,
        icon: state.icon,
        iconTone: state.tone,
        title: `${session.name}: ${state.label}${session.run ? `\n${session.run.description}` : ""}`,
      };
    }),
  );

  function runSlot(element: HTMLDivElement): () => void {
    untrack(() => terminalStore.setRunSlot(element));
    return () => {
      untrack(() => {
        if (terminalStore.runSlot === element) {
          terminalStore.setRunSlot(null);
        }
      });
    };
  }

  function status(session: TerminalEntry): { icon: IconName; tone: "success" | "danger" | "dim"; label: string } {
    if (!session.exited) {
      return { icon: "play", tone: "success", label: "Running" };
    }
    if (session.exitCode === 0) {
      return { icon: "check", tone: "success", label: "Finished" };
    }
    if (session.exitCode === null) {
      return { icon: "stop", tone: "dim", label: "Stopped" };
    }
    return { icon: "x", tone: "danger", label: `Exit code ${session.exitCode}` };
  }

  function sessionOf(id: string): TerminalEntry | null {
    return sessions.find((session) => String(session.key) === id) ?? null;
  }
</script>

<Stack gap="none" grow>
  <TabStrip
    {tabs}
    active={active ? String(active.key) : null}
    label="Runs"
    onselect={(id) => {
      const session = sessionOf(id);
      if (session) {
        terminalStore.selectRun(session.key);
      }
    }}
    onclose={(id) => {
      const session = sessionOf(id);
      if (session) {
        void terminalStore.closeRun(session.key);
      }
    }}
    oncontextmenu={(id, event) => {
      const session = sessionOf(id);
      if (session) {
        contextMenu.open(event, terminalStore.runMenuItems(session.key));
      }
    }}
  />
  <Stack direction="row" gap="none" grow>
    <Stack gap="xxs" padding="xs" label="Run actions">
      <IconButton
        icon="refresh"
        iconSize="normal"
        size="small"
        tone="success"
        label="Rerun"
        title={running ? "Stop and Rerun" : "Rerun"}
        disabled={!active?.run}
        onclick={() => active && terminalStore.rerun(active.key)}
      />
      <IconButton
        icon="stop"
        iconSize="medium"
        size="small"
        tone="danger"
        label="Stop"
        disabled={!running}
        onclick={() => active && terminalStore.stopRun(active.key)}
      />
    </Stack>
    <ElementHost fill="grow" clip label="Run output" onready={runSlot} />
  </Stack>
</Stack>
