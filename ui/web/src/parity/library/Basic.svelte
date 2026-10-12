<!-- The library side of the basic parity cases, in the same state as the app markup in cases/basic.ts. -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Input from "$ui/components/Input.svelte";
  import SearchField from "$ui/components/SearchField.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Select from "$ui/components/Select.svelte";
  import SettingRow from "$ui/components/SettingRow.svelte";
  import Slider from "$ui/components/Slider.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Switch from "$ui/components/Switch.svelte";
  import TextArea from "$ui/components/TextArea.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "button"}
  <Stack direction="row" gap="md" align="center">
    <Button>Cancel</Button>
    <Button variant="primary">Commit</Button>
    <Button variant="danger">Discard</Button>
    <Button variant="danger-primary">Delete</Button>
    <Button disabled>Disabled</Button>
    <Button size="small">Small</Button>
  </Stack>
{:else if id === "icon-button"}
  <Stack direction="row"><IconButton icon="refresh" label="Refresh" /></Stack>
{:else if id === "input"}
  <Stack gap="md" align="start">
    <Input value="feature/login" aria-label="Branch" />
    <TextArea value="fix: a typo" rows="normal" aria-label="Message" />
  </Stack>
{:else if id === "select"}
  <Select label="Cursor" value="bar" options={[{ value: "bar", label: "Bar" }, { value: "block", label: "Block" }]} />
{:else if id === "switch"}
  <Stack direction="row" gap="md"><Switch label="Off" /><Switch label="On" checked /></Stack>
{:else if id === "segmented"}
  <Segmented
    label="Theme"
    value="light"
    options={[
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ]}
  />
{:else if id === "slider"}
  <Slider label="Size" value={13} min={10} max={24} format={(value) => `${value} px`} />
{:else if id === "search-field"}
  <SearchField label="Search settings" placeholder="Search settings" value="font" />
{:else if id === "setting-row"}
  <SettingRow title="Word wrap" hint="Wrap long lines."><Switch label="Word wrap" /></SettingRow>
{/if}
