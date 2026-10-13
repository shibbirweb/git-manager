<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
</script>

<Card label="Variants">
  <SectionTitle variant="bar" title="Staged" count={3}>
    {#snippet actions()}
      <IconButton icon="minus" label="Unstage all" size="small" iconSize="medium" />
    {/snippet}
  </SectionTitle>
  <SectionTitle title="Commits only in main" count={4} />
  <SectionTitle variant="caption" title="3 files changed" />
  <SectionTitle variant="caps" title="storefront" />
  <SectionTitle variant="day" title="Today" />
  <SectionTitle variant="divided" title="Repository tools" />
  <SectionTitle variant="group" title="Editing features (a level 4 heading)" heading={4} />
</Card>
