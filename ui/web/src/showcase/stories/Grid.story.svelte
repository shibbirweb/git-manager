<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Grid from "$ui/components/Grid.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Grid label="Repositories">
  {#each ["storefront", "payments-api", "design-system", "docs", "infra"] as repo (repo)}
    <Card padded label={repo}><Text variant="label">{repo}</Text></Card>
  {/each}
</Grid>
<Grid columns={2} gap="md" label="Two columns">
  <Card padded label="Left"><Text>Left</Text></Card>
  <Card padded label="Right"><Text>Right</Text></Card>
</Grid>
