<script lang="ts">
  import SessionTabs from "$ui/components/SessionTabs.svelte";
  import Text from "$ui/components/Text.svelte";

  let sessions = $state([
    { key: "dev", name: "bun run dev", icon: "play" as const, tone: "success" as const },
    { key: "test", name: "bun run test", icon: "check" as const, tone: "success" as const },
    { key: "build", name: "cargo build --release", icon: "alert" as const, tone: "danger" as const },
    { key: "lint", name: "bun run lint", icon: "stop" as const, tone: "dim" as const },
  ]);
  let value = $state<string | null>("dev");
</script>

<SessionTabs
  label="Runs"
  {sessions}
  bind:value
  onclose={(key) => (sessions = sessions.filter((session) => session.key !== key))}
/>
<Text tone="dim">Selected: {value}</Text>
