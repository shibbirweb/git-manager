<!-- An agent's state as a small mark, like Orca's: a spinner while it works, a question mark when it needs you,
     a check when it is done, an empty ring while it waits for a first request. -->
<script lang="ts">
  import StatusIcon from "@git-manager/ui/components/StatusIcon.svelte";
  import { stateLabel } from "./agentStatus";
  import type { AgentState } from "./projects";

  let { state }: { state: AgentState } = $props();
</script>

<StatusIcon state={state === "ready" ? "idle" : state} label={stateLabel(state)} />
