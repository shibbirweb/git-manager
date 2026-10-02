<!-- The open GitHub dialog (githubDialogs.ts), inside GitDialogHost. -->
<script lang="ts">
  import CreateGistDialog from "./CreateGistDialog.svelte";
  import type { GitHubDialog } from "./githubDialogs";
  import GitHubResultDialog from "./GitHubResultDialog.svelte";
  import GitHubSignInDialog from "./GitHubSignInDialog.svelte";
  import ShareProjectDialog from "./ShareProjectDialog.svelte";

  interface Props {
    dialog: GitHubDialog;
  }

  let { dialog }: Props = $props();
</script>

{#if dialog.kind === "signIn"}
  <GitHubSignInDialog actionLabel={dialog.actionLabel} onSignedIn={dialog.onSignedIn} />
{:else if dialog.kind === "share"}
  <ShareProjectDialog repoRoot={dialog.repoRoot} />
{:else if dialog.kind === "gist"}
  <CreateGistDialog fileName={dialog.fileName} content={dialog.content} fromSelection={dialog.fromSelection} />
{:else if dialog.kind === "result"}
  <GitHubResultDialog
    title={dialog.title}
    message={dialog.message}
    url={dialog.url}
    openLabel={dialog.openLabel}
    problem={dialog.problem}
  />
{/if}
