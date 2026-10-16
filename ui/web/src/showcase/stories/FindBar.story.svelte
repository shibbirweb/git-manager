<script lang="ts">
  import FindBar from "$ui/components/FindBar.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  const text = "const total = cart.total();\nconst tax = total * rate;\nreturn total + tax;";
  let query = $state("total");
  let current = $state(1);
  let options = $state({ matchCase: false, wholeWords: false, regex: false });

  const problem = $derived.by(() => {
    if (!options.regex) {
      return null;
    }
    try {
      new RegExp(query);
      return null;
    } catch {
      return "Bad regex";
    }
  });
  const total = $derived(query && !problem ? text.split(query).length - 1 : 0);
</script>

<Stack gap="sm">
  <FindBar
    bind:query
    bind:options
    current={Math.min(current, total)}
    {total}
    {problem}
    onnext={() => (current = (current % total) + 1)}
    onprevious={() => (current = current > 1 ? current - 1 : total)}
  />
  <Text tone="dim">Type ( with Regex on to see the problem state.</Text>
  <FindBar query="total" editable={false} counter="Search wrapped" active label="Find in read-only file" />
  <Text tone="dim">Read-only, with a notice in place of the counter.</Text>
</Stack>
