<!-- The connector in front of a row that belongs to a group, like split terminals in the terminal list: a vertical
     line from the group's first row to its last, with a short tick to each row. -->
<script lang="ts">
  interface Props {
    position: "first" | "middle" | "last";
  }

  let { position }: Props = $props();
</script>

<span class="tree {position}" aria-hidden="true"></span>

<style>
  .tree {
    flex: none;
    position: relative;
    align-self: stretch;
    width: var(--tree-line-width);
    margin-right: calc(var(--tree-line-overlap) * -1);
  }

  .tree::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--border-strong);
  }

  .first::before {
    top: 50%;
  }

  .last::before {
    bottom: 50%;
  }

  .tree::after {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: var(--tree-line-width);
    border-top: 1px solid var(--border-strong);
  }
</style>
