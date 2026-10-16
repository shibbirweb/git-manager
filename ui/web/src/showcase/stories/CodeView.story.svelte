<script lang="ts">
  import CodeView from "$ui/components/CodeView.svelte";

  const source = [
    'import { repoStore } from "$lib/stores/repo.svelte";',
    "",
    "export function changedFiles(): number {",
    "  return repoStore.status?.files.length ?? 0;",
    "}",
  ].join("\n");
</script>

<CodeView {source} language="ts" />
<CodeView source={"$ git push\nEverything up-to-date"} lineNumbers={false} copy={false} />
