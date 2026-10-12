<!-- The library side of the welcome screen parity cases (cases/welcome.ts). -->
<script lang="ts">
  import Avatar from "$ui/components/Avatar.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Logo from "$ui/components/Logo.svelte";
  import Pane from "$ui/components/Pane.svelte";
  import Select from "$ui/components/Select.svelte";
  import SettingRow from "$ui/components/SettingRow.svelte";
  import Slider from "$ui/components/Slider.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "welcome-brand"}
  <Pane label="Welcome" line="soft">
    <Stack><Text variant="heading">Git Manager</Text></Stack>
  </Pane>
  <IconButton icon="settings" label="Settings" size="large" iconSize="regular" />
  <Logo size="large" />
  <Text element="h1" variant="display">Welcome to Git Manager</Text>
{:else if id === "welcome-badges"}
  <Avatar text="AB" shape="tile" color="blue" />
  <Avatar text="CD" shape="tile" color="green" />
  <Avatar text="EF" shape="tile" color="magenta" />
  <Avatar text="GH" shape="tile" color="red" />
{:else if id === "welcome-field"}
  <div style="width: 500px">
    <SettingRow title="Theme" plain>
      <Select label="Theme" value="light" options={[{ value: "light", label: "Light" }]} />
    </SettingRow>
    <SettingRow title="Interface font size" plain stacked>
      <Slider label="Size" value={13} min={10} max={20} />
    </SettingRow>
  </div>
{/if}
