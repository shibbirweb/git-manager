<!-- Standalone window used when git runs us as `mergetool`. -->
<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { settings } from "$lib/stores/settings.svelte";
  import type { MergeDocument } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import CodeBlock from "@git-manager/ui/components/CodeBlock.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import MergeEditor from "./MergeEditor.svelte";

  let doc = $state.raw<MergeDocument | null>(null);
  let loadError = $state<string | null>(null);
  let version = $state(0);
  let editor = $state<ReturnType<typeof MergeEditor> | null>(null);

  onMount(() => {
    void load(settings.ignoreWhitespace);
    const unlisten = watchClose();
    return () => {
      void unlisten.then((stop) => stop?.());
    };
  });

  /**
   * Closing the window works like Cancel: it asks before dropping an edited result. The
   * window itself is never closed here; cancelling exits the app with the unresolved status.
   */
  async function watchClose(): Promise<(() => void) | null> {
    try {
      return await getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault();
        if (!dialogs.active) {
          void (editor ? editor.cancel() : cancel());
        }
      });
    } catch {
      return null;
    }
  }

  async function load(ignoreWhitespace: boolean): Promise<void> {
    try {
      doc = await api.loadMergetool(ignoreWhitespace);
      loadError = null;
      version++;
      const name = doc.path.split("/").pop() ?? doc.path;
      await getCurrentWindow()
        .setTitle(`Merge ${name}`)
        .catch(() => undefined);
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  function reload(ignoreWhitespace: boolean): void {
    settings.ignoreWhitespace = ignoreWhitespace;
    settings.save();
    void load(ignoreWhitespace);
  }

  async function applyResult(content: string): Promise<void> {
    if (!doc) {
      return;
    }
    try {
      // Exits the process with status 0 so git marks the file resolved.
      await api.saveMergetool(content, doc.eol);
    } catch (error) {
      toast.error("Could not save the merge result", errorMessage(error));
    }
  }

  function cancel(): void {
    void api.cancelMergetool();
  }
</script>

<Stack gap="none" height="window" surface="panel">
  <Toolbar label="Merge" variant="tab">
    <Icon name="merge" size="regular" tone="dim" />
    <Text weight="semibold">Merge Revisions for</Text>
    <Text mono truncate selectable>{doc?.path ?? ""}</Text>
  </Toolbar>
  <Stack gap="none" grow>
    {#if loadError}
      <EmptyState title="Could not load the files passed by git mergetool.">
        {#snippet action()}
          <Stack gap="md" align="center">
            <CodeBlock variant="detail" text={loadError ?? ""} label="Error" />
            <Button onclick={cancel}>Quit</Button>
          </Stack>
        {/snippet}
      </EmptyState>
    {:else if doc?.binary}
      <EmptyState
        title="Binary files cannot be merged here."
        hint="Quit and resolve with git checkout --ours or --theirs."
      >
        {#snippet action()}<Button onclick={cancel}>Quit</Button>{/snippet}
      </EmptyState>
    {:else if doc}
      {#key version}
        <MergeEditor bind:this={editor} {doc} onApply={applyResult} onCancel={cancel} onReload={reload} />
      {/key}
    {:else}
      <EmptyState titleTone="dim" title="Loading..." delayed />
    {/if}
  </Stack>
</Stack>
