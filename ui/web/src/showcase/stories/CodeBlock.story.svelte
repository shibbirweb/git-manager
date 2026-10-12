<script lang="ts">
  import CodeBlock from "$ui/components/CodeBlock.svelte";
</script>

<CodeBlock text={"$ git fetch origin\nFrom github.com:you/storefront\n   4c1d2e3..9f8e7d6  main -> origin/main"} />
<CodeBlock variant="command" text="git pull --rebase origin main" />
<CodeBlock variant="detail" text={"! [rejected] main -> main (fetch first)\nerror: failed to push some refs"} />
<CodeBlock
  variant="preview"
  text={"export function total(items) {\n\treturn items.reduce((sum, item) => sum + item, 0);\n}"}
/>
