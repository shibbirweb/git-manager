<!-- The changed files of a branch comparison: status letter, name and folder; Up and Down
     move the selection. -->
<script lang="ts">
  import { fileDir, fileName, statusLetter } from "$lib/log/format";
  import type { ChangedFile } from "$lib/types";

  interface Props {
    files: ChangedFile[];
    selectedPath: string | null;
    onselect: (file: ChangedFile) => void;
  }

  let { files, selectedPath, onselect }: Props = $props();

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const index = files.findIndex((file) => file.path === selectedPath);
    const next = files[Math.max(0, Math.min(files.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      onselect(next);
    }
  }
</script>

<div class="files" role="listbox" aria-label="Changed files" tabindex="0" onkeydown={onKeydown}>
  {#each files as file (file.path)}
    <div
      class="file"
      class:selected={file.path === selectedPath}
      role="option"
      tabindex="-1"
      aria-selected={file.path === selectedPath}
      title={file.origPath ? `${file.origPath} -> ${file.path}` : file.path}
      onclick={() => onselect(file)}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          onselect(file);
        }
      }}
    >
      <span class="status status-{file.status}">{statusLetter(file.status)}</span>
      <span class="name truncate">{fileName(file.path)}</span>
      <span class="dir truncate dim">{fileDir(file.path)}</span>
    </div>
  {:else}
    <div class="empty dim">No files differ</div>
  {/each}
</div>

<style>
  .files {
    outline: none;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 10px;
    cursor: default;
  }

  .file:hover {
    background: var(--hover);
  }

  .file.selected {
    background: var(--selected-inactive);
  }

  .files:focus .file.selected {
    background: var(--selected);
  }

  .status {
    flex: none;
    width: 12px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .status-added {
    color: var(--success);
  }

  .status-deleted {
    color: var(--danger);
  }

  .status-renamed {
    color: var(--warning);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .dir {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }

  .empty {
    padding: 10px;
  }
</style>
