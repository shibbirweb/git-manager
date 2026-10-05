<script lang="ts">
  import { localKeys } from "$lib/commands/commandRuntime";
  import { tick } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import type { RepoInfo } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { syncRepo } from "../gitActions";
  import { type CommitDraft, commitDraft } from "./commitDraft.svelte";
  import { historyMenuItems, templateMenuItems } from "./commitMessageMenus";
  import { MAX_MESSAGE_HISTORY, mergeHistory } from "./commitMessages";
  import { expandTemplate, splitGitTemplate, subjectWarning } from "./commitTemplates";
  import CommitOptionsPopover from "./CommitOptionsPopover.svelte";
  import { commitRepo } from "./repoActions";
  import { type CommitChoice, commitChoiceSpec, commitDropdownItems } from "./repoMenu";
  import { syncPlan, syncTooltip } from "./sync";
  import { branchLabel, showRelativePath, type RepoSection } from "./sections";

  interface Props {
    /** Repository the commit goes to. */
    repo: RepoInfo;
    stagedCount: number;
    conflictCount: number;
    /** Several repositories are open: show the target and its picker. */
    multiRepo: boolean;
    /** Repositories offered by the picker. */
    choices: RepoSection[];
    onpick: (repoRoot: string) => void;
  }

  let { repo, stagedCount, conflictCount, multiRepo, choices, onpick }: Props = $props();

  /** Repository whose HEAD message is being loaded for amend. */
  let loadingRoot = $state<string | null>(null);
  let messageEl = $state<HTMLTextAreaElement | null>(null);
  let historyButton = $state<HTMLButtonElement | null>(null);
  // Cmd+E on macOS, where Ctrl+E moves to the end of the line; Ctrl+E elsewhere.
  const onMac = platformFromUserAgent(navigator.userAgent) === "macos";
  const historyShortcut = onMac ? "Cmd+E" : "Ctrl+E";

  const draft = $derived(commitDraft.for(repo.root));
  const status = $derived(repoStore.statuses[repo.root] ?? null);
  const unborn = $derived(status?.head?.unborn ?? false);
  const branch = $derived(branchLabel(status?.head));
  const busy = $derived(repoStore.busy !== null);
  const loadingMessage = $derived(loadingRoot === repo.root);
  const hasMessage = $derived(!draft.isBlank());
  const subjectNote = $derived(settings.commitSubjectGuide ? subjectWarning(draft.message) : null);
  const placeholder = $derived(draft.templateHint ?? (multiRepo ? `Message for ${repo.name}` : "Commit message"));
  const disabledReason = $derived.by(() => {
    if (conflictCount > 0) {
      return "Resolve conflicts before committing";
    }
    if (!draft.amend && stagedCount === 0) {
      return "Stage changes to commit";
    }
    if (!draft.amend && !hasMessage) {
      return "Enter a commit message";
    }
    return null;
  });
  const canCommit = $derived(disabledReason === null && !busy && !loadingMessage);
  const summary = $derived.by(() => {
    if (conflictCount > 0) {
      return conflictCount === 1 ? "1 conflicted file" : `${conflictCount} conflicted files`;
    }
    if (stagedCount === 0) {
      return draft.amend ? "Amend message only" : "Nothing staged";
    }
    return stagedCount === 1 ? "1 file staged" : `${stagedCount} files staged`;
  });
  const operation = $derived((status?.op?.kind ?? "none") !== "none");
  const canAmend = $derived(!unborn && conflictCount === 0 && !operation && !loadingMessage);
  const sync = $derived(syncPlan(status?.head));
  const commitKeys = localKeys("CmdOrCtrl+Enter");
  const commitHint = $derived(multiRepo ? `Commit to ${repo.name} (${commitKeys})` : `Commit (${commitKeys})`);

  function choiceLabel(choice: RepoSection): string {
    const name = showRelativePath(choice.repo) ? `${choice.repo.name} (${choice.repo.relativePath})` : choice.repo.name;
    const staged = choice.staged.length;
    return staged > 0 ? `${name}, ${staged} staged` : name;
  }

  async function toggleAmend(event: Event): Promise<void> {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const target = draft;
    const repoRoot = repo.root;
    target.amend = checked;
    if (!checked) {
      if (target.prefilled !== null && target.message === target.prefilled) {
        target.message = target.template ?? "";
      }
      target.prefilled = null;
      return;
    }
    if (!target.isBlank()) {
      return;
    }
    loadingRoot = repoRoot;
    try {
      const headMessage = (await api.getHeadMessage(repoRoot)).trimEnd();
      if (target.amend && target.isBlank()) {
        target.message = headMessage;
        target.prefilled = headMessage;
      }
    } catch (error) {
      toast.error("Could not read the last commit message", errorMessage(error));
    } finally {
      if (loadingRoot === repoRoot) {
        loadingRoot = null;
      }
    }
  }

  async function commit(): Promise<void> {
    if (!canCommit) {
      return;
    }
    await commitRepo(repo.root, { mode: "staged", amend: draft.amend, followUp: "none" });
  }

  /** The dropdown: Commit, Commit & Push, Commit & Sync, Commit (Amend). */
  function runChoice(choice: CommitChoice): void {
    const spec = commitChoiceSpec(choice);
    if (choice !== "amend" && !canCommit) {
      return;
    }
    const amend = spec.amend || draft.amend;
    void commitRepo(repo.root, { mode: "staged", amend, followUp: spec.followUp });
  }

  function openCommitMenu(event: MouseEvent): void {
    const anchor = event.currentTarget as HTMLElement;
    const items = commitDropdownItems(
      {
        busy,
        canCommit,
        canAmend,
        canPush: !!status?.head?.branch && !unborn,
        amendChecked: draft.amend,
      },
      runChoice,
    );
    contextMenu.openBelow(anchor, items, { keyboard: event.detail === 0, alignEnd: true });
  }

  // commit.template fills an empty box once per commit, like git's editor would.
  $effect(() => {
    const target = draft;
    const repoRoot = repo.root;
    if (target.templateChecked || target.amend || target.message !== "") {
      return;
    }
    target.templateChecked = true;
    void loadGitTemplate(repoRoot, target);
  });

  async function loadGitTemplate(repoRoot: string, target: CommitDraft): Promise<void> {
    const raw = await api.getCommitTemplate(repoRoot).catch(() => null);
    if (raw === null) {
      return;
    }
    const { text, comments } = splitGitTemplate(raw);
    target.templateHint = comments === "" ? null : comments;
    if (text !== "" && target.message === "" && !target.amend) {
      target.message = text;
      target.template = text;
    }
  }

  function onInput(event: Event): void {
    const next = (event.currentTarget as HTMLTextAreaElement).value;
    const previous = draft.message;
    // A cleared box keeps its text in the history.
    if (next.trim() === "" && !draft.isBlank()) {
      settings.rememberCommitMessage(repo.root, previous);
    }
    draft.message = next;
  }

  /** Puts `text` into the box; what was typed goes to the history (or is confirmed away). */
  async function replaceMessage(text: string, cursor: number | null): Promise<void> {
    const target = draft;
    const repoRoot = repo.root;
    if (!target.isBlank() && target.message !== text) {
      if (settings.commitMessageHistory) {
        settings.rememberCommitMessage(repoRoot, target.message);
      } else {
        const confirmed = await dialogs.confirm({
          title: "Replace Message",
          message: "Replace the commit message you typed?",
          confirmLabel: "Replace",
          danger: true,
        });
        if (!confirmed) {
          return;
        }
      }
    }
    target.message = text;
    await tick();
    const at = cursor ?? text.length;
    messageEl?.focus();
    messageEl?.setSelectionRange(at, at);
  }

  async function openHistory(anchor: HTMLElement, keyboard: boolean): Promise<void> {
    const repoRoot = repo.root;
    const saved = settings.commitMessages[repoRoot] ?? [];
    const fromLog = await api.recentCommitMessages(repoRoot, MAX_MESSAGE_HISTORY).catch(() => []);
    const entries = mergeHistory(saved, fromLog);
    const items = historyMenuItems(entries, Date.now(), (message) => void replaceMessage(message, null));
    contextMenu.openBelow(anchor, items, { keyboard, alignEnd: true });
  }

  async function applyTemplate(text: string): Promise<void> {
    const repoRoot = repo.root;
    let userName: string | null = null;
    if (text.includes("{user}")) {
      const identity = await api.getIdentity(repoRoot).catch(() => null);
      userName = identity?.local.name ?? identity?.global.name ?? null;
    }
    const branchName = repoStore.statuses[repoRoot]?.head?.branch ?? null;
    const expanded = expandTemplate(text, { branch: branchName, userName, date: new Date() });
    await replaceMessage(expanded.text, expanded.cursor);
  }

  async function openTemplates(event: MouseEvent): Promise<void> {
    const anchor = event.currentTarget as HTMLElement;
    const keyboard = event.detail === 0;
    const raw = await api.getCommitTemplate(repo.root).catch(() => null);
    const gitTemplate = raw === null ? null : splitGitTemplate(raw).text;
    const items = templateMenuItems(settings.commitTemplates, gitTemplate, {
      onTemplate: (text) => void applyTemplate(text),
      onGitTemplate: (text) => void replaceMessage(text, null),
      onEdit: () => settings.openDialog("merge"),
    });
    contextMenu.openBelow(anchor, items, { keyboard, alignEnd: true });
  }

  function onKeydown(event: KeyboardEvent): void {
    const command = event.metaKey || event.ctrlKey;
    if (event.key === "Enter" && command) {
      event.preventDefault();
      void commit();
      return;
    }
    if (!settings.commitMessageHistory || event.altKey || event.shiftKey) {
      return;
    }
    // Cmd+E, or Up in an empty box like a shell: the message history.
    const historyModifier = onMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    const historyKey = (historyModifier && event.code === "KeyE") || (!command && event.key === "ArrowUp" && draft.message === "");
    if (historyKey) {
      event.preventDefault();
      const anchor = historyButton ?? messageEl;
      if (anchor) {
        void openHistory(anchor, true);
      }
    }
  }
</script>

<div class="commit-box">
  {#if multiRepo}
    <div class="target">
      <span class="target-label dim">Commit to</span>
      {#if choices.length > 1}
        <select
          class="input target-select"
          value={repo.root}
          onchange={(event) => onpick(event.currentTarget.value)}
          aria-label="Repository to commit to"
          title={repo.root}
        >
          {#each choices as choice (choice.repo.root)}
            <option value={choice.repo.root}>{choiceLabel(choice)}</option>
          {/each}
        </select>
      {:else}
        <span class="target-name truncate" title={repo.root}>{repo.name}</span>
      {/if}
      {#if branch}
        <span class="target-branch dim truncate">on {branch}</span>
      {/if}
    </div>
  {/if}
  <div class="message-wrap">
    <textarea
      bind:this={messageEl}
      class="input message"
      class:with-history={settings.commitMessageHistory}
      {placeholder}
      value={draft.message}
      oninput={onInput}
      onkeydown={onKeydown}
      spellcheck="true"
      aria-label="Commit message"
    ></textarea>
    <div class="message-tools">
      {#if settings.commitMessageHistory}
        <button
          bind:this={historyButton}
          class="icon-btn tool"
          onclick={(event) => void openHistory(event.currentTarget, event.detail === 0)}
          title="Message History ({historyShortcut})"
          aria-label="Message History"
          aria-haspopup="menu"
        >
          <Icon name="history" size={13} />
        </button>
      {/if}
      <button
        class="icon-btn tool"
        onclick={(event) => void openTemplates(event)}
        title="Message Templates"
        aria-label="Message Templates"
        aria-haspopup="menu"
      >
        <Icon name="file" size={13} />
      </button>
    </div>
  </div>
  {#if subjectNote}
    <div class="subject-note" role="status">{subjectNote}</div>
  {/if}
  <div class="footer">
    <label class="amend" title={unborn ? "There is no commit to amend yet" : "Amend the last commit"}>
      <input type="checkbox" checked={draft.amend} onchange={toggleAmend} disabled={unborn || busy} />
      Amend
    </label>
    <span class="summary dim truncate">{summary}</span>
    <CommitOptionsPopover repoRoot={repo.root} disabled={busy} />
    <span class="split" role="group" aria-label="Commit">
      <button class="btn primary main" onclick={commit} disabled={!canCommit} title={disabledReason ?? commitHint}>
        {draft.amend ? "Amend Commit" : "Commit"}
      </button>
      <button
        class="btn primary chevron"
        onclick={openCommitMenu}
        disabled={busy}
        title="More commit actions"
        aria-label="More commit actions"
        aria-haspopup="menu"
      >
        <Icon name="chevron-down" size={13} />
      </button>
    </span>
  </div>
  {#if sync.kind !== "none"}
    <!-- Sync Changes: pull, then push; or publish a branch that has no upstream yet. -->
    <button class="btn sync" onclick={() => void syncRepo(repo.root)} disabled={busy} title={syncTooltip(sync)}>
      <Icon name={sync.kind === "publish" ? "cloud-upload" : "sync"} size={13} />
      {#if sync.kind === "publish"}
        Publish Branch
      {:else}
        Sync Changes
        <span class="counts">
          {#if sync.pull > 0}<span class="count" aria-label="{sync.pull} to pull">{sync.pull}<Icon name="arrow-down" size={11} /></span>{/if}
          {#if sync.push > 0}<span class="count" aria-label="{sync.push} to push">{sync.push}<Icon name="arrow-up" size={11} /></span>{/if}
        </span>
      {/if}
    </button>
  {/if}
</div>

<style>
  .sync {
    width: 100%;
    justify-content: center;
    gap: 6px;
  }

  .counts {
    display: inline-flex;
    gap: 6px;
    margin-left: 2px;
    font-variant-numeric: tabular-nums;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }

  .commit-box {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .target {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .target-label {
    flex: none;
    font-size: 12px;
  }

  .target-select {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 70%;
    height: 24px;
    padding: 0 4px;
    font-weight: 600;
  }

  .target-name {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 600;
  }

  .target-branch {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 12px;
  }

  .message-wrap {
    position: relative;
  }

  .message {
    display: block;
    width: 100%;
    height: 96px;
    line-height: 1.45;
    padding-right: 34px;
  }

  .message.with-history {
    padding-right: 58px;
  }

  .message-tools {
    position: absolute;
    top: 3px;
    right: 3px;
    display: flex;
    gap: 1px;
  }

  .tool {
    height: 22px;
    min-width: 22px;
    padding: 0 4px;
    color: var(--text-dim);
  }

  .tool:hover:not(:disabled) {
    color: var(--text);
  }

  .subject-note {
    margin-top: -4px;
    font-size: 11.5px;
    color: var(--warning);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .amend {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
  }

  .amend input {
    margin: 0;
  }

  .summary {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }

  .split {
    flex: none;
    display: inline-flex;
  }

  .split .main {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .split .chevron {
    padding: 0 5px;
    margin-left: 1px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
</style>
