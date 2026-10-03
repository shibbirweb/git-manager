<!-- Asked before a commit in a repository where git has no name and email: saves them for
     every repository (git config --global) or only this one, then the commit goes ahead. -->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { Identity, IdentityScope } from "$lib/types";
  import GitDialogFrame from "../git/GitDialogFrame.svelte";
  import { gitDialogs } from "../git/gitDialogs.svelte";
  import { identityPrefill, validateIdentityEmail, validateIdentityName } from "./identity";

  interface Props {
    repoRoot: string;
    identity: Identity;
    resolve: (saved: boolean) => void;
  }

  let { repoRoot, identity, resolve }: Props = $props();

  const start = untrack(() => identityPrefill(identity));
  let name = $state(start.name);
  let email = $state(start.email);
  let scope = $state<IdentityScope>(start.scope);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let touched = $state(false);
  let answered = false;

  const repoName = $derived(repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? "this repository");
  const nameError = $derived(validateIdentityName(name, true));
  const emailError = $derived(validateIdentityEmail(email, true));
  const canSave = $derived(nameError === null && emailError === null && !saving);

  function answer(saved: boolean): void {
    if (!answered) {
      answered = true;
      resolve(saved);
    }
  }

  // Closed any other way (another dialog took its place): no commit.
  onDestroy(() => answer(false));

  function cancel(): void {
    if (saving) {
      return;
    }
    gitDialogs.close();
  }

  async function save(): Promise<void> {
    touched = true;
    if (!canSave) {
      return;
    }
    saving = true;
    saveError = null;
    try {
      const saved = await api.setIdentity(repoRoot, scope, name, email);
      if (!saved.complete) {
        saveError = "git still has no name and email here; check your git config";
        return;
      }
      answer(true);
      gitDialogs.close();
    } catch (error) {
      saveError = errorMessage(error);
    } finally {
      saving = false;
    }
  }
</script>

<GitDialogFrame title="Who is committing?" width={460} closable={!saving} onCancel={cancel} onSubmit={() => void save()}>
  <p class="hint intro">git needs a name and email for each commit. They are saved in your git config.</p>
  <label class="field">
    <span>Name</span>
    <input class="input" bind:value={name} placeholder="Ann Lee" autocomplete="off" spellcheck="false" />
  </label>
  {#if touched && nameError}
    <div class="error">{nameError}</div>
  {/if}
  <label class="field">
    <span>Email</span>
    <input class="input" type="email" bind:value={email} placeholder="ann@example.com" autocomplete="off" spellcheck="false" />
  </label>
  {#if touched && emailError}
    <div class="error">{emailError}</div>
  {/if}
  <fieldset class="scopes">
    <legend class="hint">Use for</legend>
    <label class="check">
      <input type="radio" name="identity-scope" value="global" bind:group={scope} />
      All repositories (<code>--global</code>)
    </label>
    <label class="check">
      <input type="radio" name="identity-scope" value="local" bind:group={scope} />
      Only {repoName}
    </label>
  </fieldset>
  {#if saveError}
    <div class="error">{saveError}</div>
  {/if}

  {#snippet footer()}
    {#if saving}<span class="spinner" aria-label="Saving"></span>{/if}
    <button class="btn" onclick={cancel} disabled={saving}>Cancel</button>
    <button class="btn primary" onclick={() => void save()} disabled={saving || (touched && !canSave)}>Save and Commit</button>
  {/snippet}
</GitDialogFrame>

<style>
  .intro {
    margin: 0;
  }

  .scopes {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .scopes legend {
    padding: 0;
    margin-bottom: 4px;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
</style>
