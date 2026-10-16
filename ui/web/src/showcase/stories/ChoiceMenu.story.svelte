<script lang="ts">
  import ChoiceMenu from "$ui/components/ChoiceMenu.svelte";
  import Popover from "$ui/components/Popover.svelte";
  import StatusItem from "$ui/components/StatusItem.svelte";
  import StatusDot from "$ui/components/StatusDot.svelte";

  let mode = $state<"off" | "agents" | "always">("agents");
  const choices = [
    { value: "off" as const, label: "Off", description: "Let the computer sleep as usual." },
    { value: "agents" as const, label: "While agents run", description: "Stay awake until the last agent ends." },
    { value: "always" as const, label: "Always", description: "Stay awake while the app is open." },
  ];
</script>

<Popover label="Keep Awake" width="small" padding="menu" placement="above">
  {#snippet trigger({ toggle, open })}
    <StatusItem icon="coffee" text={choices.find((choice) => choice.value === mode)?.label} {open} onclick={toggle}>
      {#snippet trailing()}<StatusDot size="small" tone={mode === "off" ? "neutral" : "success"} />{/snippet}
    </StatusItem>
  {/snippet}
  <ChoiceMenu title="Keep Awake" status={mode === "off" ? "Off" : "On"} {choices} bind:value={mode} />
</Popover>
