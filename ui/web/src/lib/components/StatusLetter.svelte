<!-- A changed file's status letter in its color: A added, M modified, D deleted, R renamed, U untracked,
     C conflicted, T type change. -->
<script lang="ts">
  import { statusLabel, statusLetter, type FileKind } from "../logic/fileStatus";

  interface Props {
    kind: FileKind | null;
  }

  let { kind }: Props = $props();
</script>

<span class="letter kind-{kind ?? 'conflicted'}" title={statusLabel(kind)}>{statusLetter(kind)}</span>

<style>
  .letter {
    flex: none;
    width: var(--file-row-letter-width);
    font-family: var(--font-mono);
    font-size: var(--font-size-compact);
    font-weight: var(--font-weight-bold);
    text-align: center;
  }

  .kind-added {
    color: var(--success);
  }

  .kind-modified,
  .kind-typechange {
    color: var(--accent);
  }

  .kind-deleted {
    color: var(--danger);
    opacity: 0.8;
  }

  .kind-renamed {
    color: var(--tok-property);
  }

  .kind-untracked {
    color: color-mix(in srgb, var(--success) 60%, var(--text-faint));
  }

  .kind-conflicted {
    color: var(--danger);
  }
</style>
