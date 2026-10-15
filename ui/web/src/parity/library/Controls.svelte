<!-- The library side of the control and variant parity cases (cases/controls.ts, cases/variants.ts). -->
<script lang="ts">
  import ActivityBar from "$ui/components/ActivityBar.svelte";
  import Badge from "$ui/components/Badge.svelte";
  import ChoiceMenu from "$ui/components/ChoiceMenu.svelte";
  import DialogHead from "$ui/components/DialogHead.svelte";
  import DiffView from "$ui/components/DiffView.svelte";
  import Divider from "$ui/components/Divider.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import MediaCompare from "$ui/components/MediaCompare.svelte";
  import MediaView from "$ui/components/MediaView.svelte";
  import PaletteRow from "$ui/components/PaletteRow.svelte";
  import SearchField from "$ui/components/SearchField.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import SessionTabs from "$ui/components/SessionTabs.svelte";
  import SideNav from "$ui/components/SideNav.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import ToggleButton from "$ui/components/ToggleButton.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
  // A 1 px transparent GIF, so the canvas has an image to show.
  const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
</script>

{#if id === "choice-menu"}
  <ChoiceMenu
    title="Keep Awake"
    status="Off"
    value="off"
    choices={[{ value: "off", label: "Off", description: "Sleep as usual." }]}
  />
{:else if id === "dialog-head"}
  <DialogHead icon="lock" title="Password" subtitle="git asks for this." />
{:else if id === "panel-dialog-head"}
  <DialogHead size="panel" icon="cloud-download" title="Update" />
{:else if id === "zoom-bar"}
  <MediaView kind="image" name="x" src={PIXEL} />
{:else if id === "media-compare"}
  <MediaCompare
    sides={[
      { label: "HEAD", kind: "none", info: "9 KB" },
      { label: "Working tree", kind: "none" },
    ]}
  />
{:else if id === "session-tabs"}
  <SessionTabs
    label="Runs"
    value="t"
    sessions={[{ key: "t", name: "bun run test", icon: "check", tone: "success" }]}
    onclose={run}
  />
{:else if id === "palette-command"}
  <PaletteRow item={{ id: "p", title: "Push", category: "Git", disabled: true, reason: "No repository" }} />
  <PaletteRow item={{ id: "w", title: "Wrap", checked: true }} />
{:else if id === "recent-head"}
  <ToggleButton variant="chip" label="Edited only" text="Edited only" pressed />
  <PaletteRow item={{ id: "d", title: "tax.ts", dirty: true }} />
{:else if id === "small-badge"}
  <Badge count={3} size="small" tone="warning" />
{:else if id === "file-bar"}
  <Toolbar variant="file" label="File">
    <Divider direction="vertical" />
    <ToggleButton variant="tool" icon="history" label="Blame" pressed />
    <Segmented label="Mode" size="small" value="a" options={[{ value: "a", icon: "split-view", title: "A" }]} />
  </Toolbar>
  <Toolbar variant="conflict" label="Conflicts"><Icon name="alert" size="medium" tone="danger" /></Toolbar>
{:else if id === "diff-labels"}
  <DiffView
    label="Diff"
    original="a"
    modified="b"
    height="small"
    sideLabels={{ original: "HEAD", modified: "Working tree" }}
  />
{/if}
