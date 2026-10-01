<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { pickAndOpenRepo, pickAndOpenWorkspaceFile } from "./repoPicker";
  import { updates } from "$lib/update/updates.svelte";

  function displayName(repoPath: string): string {
    return repoPath.split("/").filter(Boolean).pop() ?? repoPath;
  }
</script>

<main class="welcome">
  <div class="card">
    <div class="brand">
      <div class="logo"><Icon name="merge" size={26} /></div>
      <div>
        <h1>Git Manager</h1>
        <p class="dim">Open any folder: one repository, many repositories, or none yet.</p>
      </div>
    </div>

    <button class="btn primary open" onclick={pickAndOpenRepo}>
      <Icon name="folder" size={15} />
      Open Folder...
    </button>
    <div class="links">
    <button class="settings-link" onclick={() => void pickAndOpenWorkspaceFile()}>
      <Icon name="folder-git" size={13} />
      Open Workspace from File...
    </button>
    <button class="settings-link" onclick={() => settings.openDialog()}>
      <Icon name="settings" size={13} />
      Settings
    </button>
    </div>
    <div class="links">
      <button class="settings-link" onclick={() => void updates.openRepository()}>
        <Icon name="star" size={13} />
        Star on GitHub
      </button>
      <button class="settings-link" onclick={() => void updates.reportBug()}>
        <Icon name="bug" size={13} />
        Report a Bug
      </button>
      <button class="settings-link" onclick={() => void updates.requestFeature()}>
        <Icon name="lightbulb" size={13} />
        Request a Feature
      </button>
    </div>

    {#if settings.stateLoadError}
      <p class="notice">
        <Icon name="alert" size={13} />
        <span>Recent folders could not be loaded because state.json could not be read.</span>
        <button class="settings-link" onclick={() => settings.openDialog("files")}>Open Settings</button>
      </p>
    {/if}

    {#if settings.recentWorkspaceFiles.length > 0 || settings.recentWorkspaces.length > 0}
      <h2>Recent Workspaces</h2>
      <ul class="recent">
        {#each settings.recentWorkspaceFiles as file (file)}
          <li>
            <button class="recent-item" onclick={() => repoStore.openWorkspaceFile(file)}>
              <span class="name">{displayName(file).replace(/\.(gitmanager|code)-workspace$/, "")}</span>
              <span class="path dim truncate">{file}</span>
            </button>
            <button
              class="icon-btn remove"
              title="Remove from list"
              aria-label="Remove workspace file from recent"
              onclick={() => settings.removeRecentWorkspaceFile(file)}
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        {/each}
        {#each settings.recentWorkspaces as folders (folders.join("\n"))}
          <li>
            <button class="recent-item" onclick={() => repoStore.openFolders(folders)}>
              <span class="name">{folders.map(displayName).join(", ")}</span>
              <span class="path dim truncate">{folders.length} folders</span>
            </button>
            <button
              class="icon-btn remove"
              title="Remove from list"
              aria-label="Remove workspace from recent"
              onclick={() => settings.removeRecentWorkspace(folders)}
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if settings.recentRepos.length > 0}
      <h2>Recent Folders</h2>
      <ul class="recent">
        {#each settings.recentRepos as repoPath (repoPath)}
          <li>
            <button class="recent-item" onclick={() => repoStore.open(repoPath)}>
              <span class="name">{displayName(repoPath)}</span>
              <span class="path dim truncate">{repoPath}</span>
            </button>
            <button
              class="icon-btn remove"
              title="Remove from list"
              aria-label="Remove {displayName(repoPath)} from recent"
              onclick={() => settings.removeRecent(repoPath)}
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>

<style>
  .welcome {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .card {
    width: min(520px, 100%);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    padding: 28px;
    box-shadow: var(--shadow);
  }

  .brand {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-bottom: 22px;
  }

  .logo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--accent-text);
  }

  h1 {
    margin: 0 0 2px;
    font-size: 20px;
  }

  p {
    margin: 0;
  }

  .links {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin-top: 10px;
  }

  .links .settings-link {
    margin: 0;
  }

  .settings-link {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px auto 0;
    padding: 2px 6px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
  }

  .settings-link:hover {
    color: var(--accent);
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 18px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
    font-size: 12px;
  }

  .notice :global(svg) {
    flex: none;
    color: var(--danger);
  }

  .notice span {
    flex: 1;
  }

  .notice .settings-link {
    margin: 0;
    flex: none;
  }

  .open {
    width: 100%;
    justify-content: center;
    height: 34px;
  }

  h2 {
    margin: 24px 0 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow: auto;
  }

  li {
    display: flex;
    align-items: center;
    border-radius: var(--radius);
  }

  li:hover {
    background: var(--hover);
  }

  .recent-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 7px 10px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .name {
    font-weight: 500;
  }

  .path {
    max-width: 100%;
    font-size: 12px;
  }

  .remove {
    visibility: hidden;
    margin-right: 4px;
  }

  li:hover .remove {
    visibility: visible;
  }
</style>
