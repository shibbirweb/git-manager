<!-- The Rebase dialog: "Rebase BRANCH" onto a branch or commit, with --interactive
     (opens the Interactive Rebase dialog), --rebase-merges, --keep-empty, --root,
     --update-refs and --onto with an upstream for the three-argument form. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { Refs } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { decodeRefPick, refPickItems } from "../changes/repoPickers";
  import { loadDetails } from "../changes/repoActions";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import {
    DEFAULT_REBASE_OPTIONS,
    REBASE_FLAGS,
    type RebaseDialogOptions,
    type RebaseFlag,
    rebaseCommand,
    rebaseFlagDisabled,
    rebaseRequest,
    toggleRebaseFlag,
    validateRebase,
  } from "./integrateOptions";

  interface Props {
    repoRoot: string;
    onto: string | null;
  }

  let { repoRoot, onto: initialOnto }: Props = $props();

  let refs = $state.raw<Refs | null>(null);
  let options = $state<RebaseDialogOptions>(untrack(() => ({ ...DEFAULT_REBASE_OPTIONS, onto: initialOnto })));
  let starting = $state(false);

  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const current = $derived(status?.head.branch ?? null);
  const branchLabel = $derived(options.branchName || current || "HEAD");
  const operation = $derived((status?.op.kind ?? "none") !== "none");
  const error = $derived(validateRebase(options));
  const interactiveElsewhere = $derived(options.interactive && options.branchName !== null && options.branchName !== current);
  const command = $derived(rebaseCommand(options));
  const canStart = $derived(error === null && !interactiveElsewhere && !operation && !starting && repoStore.busy === null);
  const localBranches = $derived((refs?.local ?? []).map((branch) => branch.name));

  onMount(() => {
    void loadDetails(repoRoot).then((details) => {
      refs = details.refs;
    });
  });

  function close(): void {
    gitDialogs.close();
  }

  function setFlag(flag: RebaseFlag, on: boolean): void {
    options = toggleRebaseFlag(options, flag, on);
  }

  async function choose(field: "onto" | "upstream"): Promise<void> {
    const picked = decodeRefPick(
      await dialogs.pick({
        title: field === "onto" ? `Rebase ${branchLabel} onto` : "Upstream: the commits after it move",
        placeholder: "Select a branch or tag",
        items: refPickItems(refs, { local: true, remote: true, tags: true, skipCurrent: true }),
        emptyText: "No other branches",
      }),
    );
    if (picked && picked.kind !== "create" && picked.kind !== "createFrom") {
      options = { ...options, [field]: picked.name };
    }
  }

  async function startInteractive(upstream: string): Promise<void> {
    starting = true;
    try {
      const plan = await api.rebasePlanOnto(repoRoot, upstream);
      if (plan.commits.length === 0) {
        toast.info(`${current ?? "HEAD"} has no commits that ${upstream} lacks`);
        return;
      }
      gitDialogs.open({ kind: "rebase", repoRoot, plan });
    } catch (failure) {
      toast.error("Could not start the interactive rebase", errorMessage(failure));
    } finally {
      starting = false;
    }
  }

  async function submit(): Promise<void> {
    if (!canStart) {
      return;
    }
    const onto = (options.onto ?? "").trim();
    if (options.interactive) {
      await startInteractive(onto);
      return;
    }
    const request = rebaseRequest(options);
    const label = branchLabel;
    const target = request.root && !request.useOnto ? "its root" : (request.onto ?? onto);
    close();
    await repoStore.runOp("Rebase", (repoPath) => api.rebaseWithOptions(repoPath, request), `Rebased ${label} onto ${target}`, repoRoot);
  }
</script>

<GitDialogFrame title="Rebase {branchLabel}" width={580} onCancel={close} onSubmit={() => void submit()}>
  {#if operation}
    <p class="error">Finish or abort the {status?.op.description ?? "operation"} in progress first.</p>
  {/if}
  <label class="field">
    <span>Branch to rebase</span>
    <select
      class="input"
      value={options.branchName ?? ""}
      onchange={(event) => (options = { ...options, branchName: event.currentTarget.value || null })}
    >
      <option value="">{current ? `${current} (current)` : "HEAD (detached)"}</option>
      {#each localBranches.filter((name) => name !== current) as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>
  {#if !options.root || options.useOnto}
    <label class="field">
      <span>{options.useOnto ? "New base (--onto)" : "Onto branch or commit"}</span>
      <div class="row">
        <input
          class="input mono grow"
          value={options.onto ?? ""}
          oninput={(event) => (options = { ...options, onto: event.currentTarget.value })}
          placeholder="main"
          spellcheck="false"
          autocomplete="off"
          data-autofocus
        />
        <button type="button" class="btn" onclick={() => void choose("onto")}>Choose...</button>
      </div>
    </label>
  {/if}
  {#if options.useOnto && !options.root}
    <label class="field">
      <span>Upstream: only the commits after it move</span>
      <div class="row">
        <input
          class="input mono grow"
          value={options.upstream ?? ""}
          oninput={(event) => (options = { ...options, upstream: event.currentTarget.value })}
          placeholder="old-base"
          spellcheck="false"
          autocomplete="off"
        />
        <button type="button" class="btn" onclick={() => void choose("upstream")}>Choose...</button>
      </div>
    </label>
  {/if}
  <div class="flags">
    {#each REBASE_FLAGS as entry (entry.flag)}
      {@const disabled = rebaseFlagDisabled(options, entry.flag)}
      <label class="check flag" class:disabled>
        <input
          type="checkbox"
          checked={options[entry.flag]}
          {disabled}
          onchange={(event) => setFlag(entry.flag, event.currentTarget.checked)}
        />
        <span class="mono">{entry.label}</span>
        <span class="hint">{entry.description}</span>
      </label>
    {/each}
  </div>
  {#if options.interactive}
    <div class="hint">Merge commits in the range are kept automatically.</div>
  {/if}
  {#if interactiveElsewhere}
    <div class="error">--interactive rebases the checked-out branch: check out {options.branchName} first.</div>
  {:else if error && ((options.onto ?? "") !== "" || options.useOnto)}
    <div class="error">{error}</div>
  {/if}
  <div class="command selectable">{command}</div>

  {#snippet footer()}
    <span class="hint">&#8984;Enter to rebase</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canStart} onclick={() => void submit()}>
      {options.interactive ? "Next..." : "Rebase"}
    </button>
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
    grid-template-columns: auto 120px 1fr;
    align-items: center;
  }

  .disabled {
    opacity: 0.55;
  }
</style>
