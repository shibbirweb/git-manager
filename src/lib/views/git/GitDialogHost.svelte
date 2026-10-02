<!-- Shows the Git menu dialog that is open (gitDialogs.svelte.ts). Each mounts fresh, so it
     starts from the repository's current state. -->
<script lang="ts">
  import GitHubDialogHost from "../github/GitHubDialogHost.svelte";
  import BranchesPopup from "./BranchesPopup.svelte";
  import CloneDialog from "./CloneDialog.svelte";
  import MergeDialog from "./MergeDialog.svelte";
  import RebaseBranchDialog from "./RebaseBranchDialog.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import InteractiveRebaseDialog from "./InteractiveRebaseDialog.svelte";
  import PullDialog from "./PullDialog.svelte";
  import PushDialog from "./PushDialog.svelte";
  import RemotesDialog from "./RemotesDialog.svelte";
  import ResetDialog from "./ResetDialog.svelte";
  import RollbackDialog from "./RollbackDialog.svelte";
  import ShelveDialog from "$lib/shelf/ShelveDialog.svelte";
  import UpdateProjectDialog from "./UpdateProjectDialog.svelte";
  import AddSubmoduleDialog from "./submodules/AddSubmoduleDialog.svelte";
  import NewWorktreeDialog from "./worktrees/NewWorktreeDialog.svelte";

  const active = $derived(gitDialogs.active);
</script>

{#if active}
  {#key active}
    {#if active.kind === "push"}
      <PushDialog repoRoot={active.repoRoot} />
    {:else if active.kind === "pull"}
      <PullDialog repoRoot={active.repoRoot} />
    {:else if active.kind === "reset"}
      <ResetDialog repoRoot={active.repoRoot} />
    {:else if active.kind === "rollback"}
      <RollbackDialog repoRoot={active.repoRoot} filePaths={active.filePaths} />
    {:else if active.kind === "shelve"}
      <ShelveDialog repoRoot={active.repoRoot} filePaths={active.filePaths} />
    {:else if active.kind === "remotes"}
      <RemotesDialog repoRoot={active.repoRoot} />
    {:else if active.kind === "clone"}
      <CloneDialog />
    {:else if active.kind === "update"}
      <UpdateProjectDialog />
    {:else if active.kind === "rebase"}
      <InteractiveRebaseDialog repoRoot={active.repoRoot} plan={active.plan} />
    {:else if active.kind === "merge"}
      <MergeDialog repoRoot={active.repoRoot} branchName={active.branchName} />
    {:else if active.kind === "rebaseBranch"}
      <RebaseBranchDialog repoRoot={active.repoRoot} onto={active.onto} />
    {:else if active.kind === "branches"}
      <BranchesPopup repoRoot={active.repoRoot} />
    {:else if active.kind === "github"}
      <GitHubDialogHost dialog={active.dialog} />
    {:else if active.kind === "newWorktree"}
      <NewWorktreeDialog repoRoot={active.repoRoot} />
    {:else if active.kind === "addSubmodule"}
      <AddSubmoduleDialog repoRoot={active.repoRoot} />
    {/if}
  {/key}
{/if}
