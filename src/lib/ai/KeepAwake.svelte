<!-- Keep computer awake in the status bar, like Orca's: a coffee cup, the mode and a dot that fills while the computer
     is held awake. Click for the menu: the title and status, then On, Agent and Off with what each does. -->
<script lang="ts">
  import ChoiceMenu from "@nibtree/ui/components/ChoiceMenu.svelte";
  import Popover from "@nibtree/ui/components/Popover.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import StatusDot from "@nibtree/ui/components/StatusDot.svelte";
  import StatusItem from "@nibtree/ui/components/StatusItem.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { ComputerAwakeMode } from "$lib/stores/settingsData";
  import { platformName } from "$lib/update/releases";
  import { keepAwake } from "./keepAwakeStore.svelte";
  import { AWAKE_MODES, AWAKE_TITLE, lidNote, modeLabel, statusText } from "./keepAwakeModel";

  let open = $state(false);

  const mode = $derived(settings.computerAwakeMode);
  const status = $derived(statusText(mode, keepAwake.active));
  const note = lidNote(platformName(navigator.userAgent));
  const tooltip = $derived(
    keepAwake.error ? `${AWAKE_TITLE}: ${keepAwake.error}` : `${AWAKE_TITLE}, ${status}. ${note}`,
  );

  function choose(value: ComputerAwakeMode): void {
    settings.setPreference("computerAwakeMode", value);
    open = false;
  }
</script>

<Popover bind:open label={AWAKE_TITLE} placement="above" align="end" width="small" textSize="small">
  {#snippet trigger({ toggle, open: shown })}
    <StatusItem
      icon="coffee"
      text={modeLabel(mode)}
      variant="quiet"
      active={keepAwake.active}
      label="{AWAKE_TITLE}, {status}"
      title={tooltip}
      open={shown}
      onclick={toggle}
    >
      {#snippet trailing()}
        <StatusDot size="small" tone={keepAwake.active ? "success" : "neutral"} />
      {/snippet}
    </StatusItem>
  {/snippet}
  <Stack gap="xs">
    <ChoiceMenu title={AWAKE_TITLE} {status} choices={[...AWAKE_MODES]} value={mode} onchange={choose} />
    {#if keepAwake.error}
      <Stack paddingX="sm" paddingY="xs" line="top">
        <Text size="xsmall" tone="danger">{keepAwake.error}</Text>
      </Stack>
    {/if}
  </Stack>
</Popover>
