<script lang="ts">
  import "../app.css";
  import "@git-manager/ui/styles/base.css";
  import "@git-manager/ui/styles/code.css";
  import "@git-manager/ui/styles/tokens.css";

  let { children } = $props();
</script>

{@render children()}
