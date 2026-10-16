<!-- The status bar's memory item: the whole app's memory, polled while the window shows, with a details popover
     (each process, the terminals, GPU acceleration) and, on macOS, Clear Cache beside it. -->
<script lang="ts">
  import Meter from "@git-manager/ui/components/Meter.svelte";
  import Popover from "@git-manager/ui/components/Popover.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import StatusItem from "@git-manager/ui/components/StatusItem.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { onMount, untrack } from "svelte";
  import { api } from "$lib/api";
  import { clearCache } from "$lib/debug/clearCache";
  import { settings } from "$lib/stores/settings.svelte";
  import { gpuRenderers } from "$lib/terminal/gpuRenderers.svelte";
  import { terminalDrawingSummary, type WebglInfo, webglLabel } from "$lib/terminal/gpuStatus";
  import TerminalMemory from "$lib/terminal/TerminalMemory.svelte";
  import type { MemoryUsage } from "$lib/types";
  import { formatBytes } from "$lib/ui/formatBytes";
  import { probeWebgl } from "$lib/ui/webglProbe";
  import { platformName } from "$lib/update/releases";

  const POLL_MS = 5000;

  let memory = $state.raw<MemoryUsage | null>(null);
  /** Clear Cache and the WebKit wording are macOS only; Windows counts WebView2 like Task Manager. */
  const onMac = platformName(navigator.userAgent) === "macOS";
  const gpuNote =
    `The window always draws with the GPU through ${onMac ? "macOS" : "WebView2"} (the Graphics process above). ` +
    "Only terminals add WebGL drawing, set in Settings, Terminal.";
  let open = $state(false);
  /** Checked each time the popup opens; the test context is released at once. */
  let webgl = $state<WebglInfo | null>(null);
  const terminalDrawing = $derived(
    terminalDrawingSummary({
      drawings: [...gpuRenderers.drawings.values()],
      gpuSetting: settings.terminalGpuAcceleration,
      ligatures: settings.terminalLigatures,
    }),
  );

  async function poll(): Promise<void> {
    try {
      memory = await api.memoryUsage();
    } catch {
      memory = null;
    }
  }

  onMount(() => {
    void poll();
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => void poll(), POLL_MS);
    };
    // Measuring costs a little CPU; skip it while the window is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        void poll();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  });

  // Fresh numbers each time the details open.
  $effect(() => {
    if (open) {
      untrack(() => {
        void poll();
        webgl = probeWebgl();
      });
    }
  });

  const CLEAR_CACHE_TITLE =
    "Clear Cache: restart this window's interface to give back all the memory it holds. The screen blinks once; " +
    "your folder and tabs come back.";
</script>

{#if memory && memory.totalBytes > 0}
  {@const total = memory.totalBytes}
  <Popover bind:open label="Memory usage" placement="above" align="end" width="medium" padding="panel" textSize="small">
    {#snippet trigger({ toggle: show, open: shown })}
      <StatusItem
        icon="memory"
        text={formatBytes(total)}
        label="Memory {formatBytes(total)}"
        title="Memory used by Git Manager and its web view processes. Click for details."
        open={shown}
        onclick={show}
      />
    {/snippet}
    <Stack gap="sm">
      <Stack direction="row" justify="between">
        <Text weight="semibold">Memory</Text>
        <Text weight="semibold" tabular>{formatBytes(total)}</Text>
      </Stack>
      {#each memory.processes as process (process.pid)}
        <Meter
          label={process.label}
          value={formatBytes(process.bytes)}
          fraction={Math.max(0.02, process.bytes / total)}
          title="{process.name} (pid {process.pid})"
        />
      {/each}
      <TerminalMemory onShow={() => (open = false)} />
      <Stack gap="xs" line="top" paddingY="sm" label="GPU acceleration">
        <Text size="xsmall" weight="semibold" tone="dim">GPU acceleration</Text>
        <Stack direction="row" justify="between" gap="md">
          <Text size="small">Terminals use the GPU</Text>
          <Text size="small" tone="dim" truncate title={terminalDrawing}>{terminalDrawing}</Text>
        </Stack>
        <Stack direction="row" justify="between" gap="md">
          <Text size="small">WebGL support</Text>
          <Text size="small" tone="dim" truncate title={webglLabel(webgl)}>{webglLabel(webgl)}</Text>
        </Stack>
        <Text size="xsmall" tone="dim" element="p">
          {gpuNote}
        </Text>
      </Stack>
      <Text size="xsmall" tone="dim" element="p">
        {#if onMac}
          Physical memory of the whole app, all windows together, as Activity Monitor shows it. The UI runs in macOS
          WebKit helper processes, one web content process per window, which are counted too.
        {:else}
          Memory of the whole app, all windows together, as Task Manager shows it (private working set). The UI runs in
          Microsoft Edge WebView2 processes, which are counted too.
        {/if}
        {#if memory.approximate}
          Started from a terminal, so helpers are matched by start time.
        {/if}
      </Text>
    </Stack>
  </Popover>
  {#if onMac}
    <StatusItem icon="brush" label="Clear Cache" title={CLEAR_CACHE_TITLE} onclick={() => void clearCache()} />
  {/if}
{/if}
