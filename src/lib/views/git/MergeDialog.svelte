<!-- The Merge dialog: "Merge into BRANCH", the branch to merge, the merge options,
     the commit message when a merge commit can be made, and the command it runs. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { MergeOptions, Refs } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { decodeRefPick, refPickItems } from "../changes/repoPickers";
  import { loadDetails } from "../changes/repoActions";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { validateRevision } from "./gitOptions";
  import {
    DEFAULT_MERGE_OPTIONS,
    MERGE_FLAGS,
    type MergeFlag,
    mergeCommand,
    mergeDoneMessage,
    mergeRequest,
    mergeShowsMessage,
    toggleMergeFlag,
  } from "./integrateOptions";

  interface Props {
    repoRoot: string;
    branchName: string | null;
  }

  let { repoRoot, branchName: initialBranch }: Props = $props();

  let refs = $state.raw<Refs | null>(null);
  let branchName = $state(untrack(() => initialBranch ?? ""));
  let options = $state<MergeOptions>({ ...DEFAULT_MERGE_OPTIONS });

  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const current = $derived(status?.head.branch ?? "HEAD");
  const operation = $derived((status?.op.kind ?? "none") !== "none");
  const branchError = $derived(branchName.trim() === "" ? null : validateRevision(branchName));
  const command = $derived(mergeCommand(branchName, options));
  const canMerge = $derived(branchName.trim() !== "" && branchError === null && !operation && repoStore.busy === null);

  onMount(() => {
    void loadDetails(repoRoot).then((details) => {
      refs = details.refs;
    });
  });

  function close(): void {
    gitDialogs.close();
  }

  function setFlag(flag: MergeFlag, on: boolean): void {
    options = toggleMergeFlag(options, flag, on);
  }

  async function chooseBranch(): Promise<void> {
    const picked = decodeRefPick(
      await dialogs.pick({
        title: `Merge into ${current}`,
        placeholder: "Select a branch or tag to merge",
        items: refPickItems(refs, { local: true, remote: true, tags: true, skipCurrent: true }),
        emptyText: "No other branches",
      }),
    );
    if (picked && picked.kind !== "create" && picked.kind !== "createFrom") {
      branchName = picked.name;
    }
  }

  async function submit(): Promise<void> {
    if (!canMerge) {
      return;
    }
    const target = branchName.trim();
    const request = mergeRequest(options);
    const into = current;
    close();
    await repoStore.runOp(
      "Merge",
      (repoPath) => api.mergeWithOptions(repoPath, target, request),
      mergeDoneMessage(target, into, request),
      repoRoot,
    );
  }
</script>

<GitDialogFrame title="Merge into {current}" width={540} onCancel={close} onSubmit={() => void submit()}>
  {#if operation}
    <p class="error">Finish or abort the {status?.op.description ?? "operation"} in progress first.</p>
  {/if}
  <label class="field">
    <span>Branch to merge</span>
    <div class="row">
      <input
        class="input mono grow"
        bind:value={branchName}
        placeholder="feature/my-change"
        spellcheck="false"
        autocomplete="off"
        aria-label="Branch to merge"
        data-autofocus
      />
      <button type="button" class="btn" onclick={() => void chooseBranch()}>Choose...</button>
    </div>
  </label>
  {#if branchError}
    <div class="error">{branchError}</div>
  {/if}
  <div class="flags">
    {#each MERGE_FLAGS as entry (entry.flag)}
      <label class="check flag">
        <input type="checkbox" checked={options[entry.flag]} onchange={(event) => setFlag(entry.flag, event.currentTarget.checked)} />
        <span class="mono">{entry.label}</span>
        <span class="hint">{entry.description}</span>
      </label>
    {/each}
  </div>
  {#if mergeShowsMessage(options)}
    <label class="field">
      <span>Commit message (-m)</span>
      <textarea
        class="input message"
        rows="3"
        value={options.message ?? ""}
        oninput={(event) => (options = { ...options, message: event.currentTarget.value })}
        placeholder="Merge branch '{branchName.trim() || 'branch'}' into {current}"
        spellcheck="true"
      ></textarea>
    </label>
  {/if}
  <div class="command selectable">{command}</div>

  {#snippet footer()}
    <span class="hint">&#8984;Enter to merge</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canMerge} onclick={() => void submit()}>Merge</button>
  {/snippet}
</GitDialogFrame>

<style>
  .grow {
    flex: 1;
    min-width: 0;
  }

  .flags {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .flag {
    display: grid;
    grid-template-columns: auto 100px 1fr;
    align-items: center;
  }

  .message {
    width: 100%;
    resize: vertical;
    line-height: 1.45;
  }
</style>
